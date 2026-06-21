import type {
	MatchResult,
	Team,
	TeamStanding,
	RankingSnapshot,
	MatchImpact
} from './types';
import {
	getTeamsBySeason,
	getMatchResultsBySeason,
	getRankingSnapshotsBefore,
	saveRankingSnapshots,
	getFixtureById
} from './db';

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export interface StandingStats {
	points: number;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	forfeits: number;
	headToHead: Map<string, { points: number; goalDifference: number }>;
}

function createEmptyStats(): StandingStats {
	return {
		points: 0,
		played: 0,
		won: 0,
		drawn: 0,
		lost: 0,
		goalsFor: 0,
		goalsAgainst: 0,
		goalDifference: 0,
		forfeits: 0,
		headToHead: new Map()
	};
}

function updateHeadToHead(
	stats: StandingStats,
	opponentId: string,
	points: number,
	goalDiff: number
): void {
	if (!stats.headToHead.has(opponentId)) {
		stats.headToHead.set(opponentId, { points: 0, goalDifference: 0 });
	}
	const h2h = stats.headToHead.get(opponentId)!;
	h2h.points += points;
	h2h.goalDifference += goalDiff;
}

function processMatchResult(
	homeStats: StandingStats,
	awayStats: StandingStats,
	result: MatchResult
): void {
	let homeScore = result.homeScore;
	let awayScore = result.awayScore;
	let homePoints = 0;
	let awayPoints = 0;

	if (result.isHomeForfeit && result.isAwayForfeit) {
		homeStats.forfeits++;
		awayStats.forfeits++;
		homeStats.played++;
		awayStats.played++;
		updateHeadToHead(homeStats, result.awayTeamId, 0, 0);
		updateHeadToHead(awayStats, result.homeTeamId, 0, 0);
		return;
	}

	if (result.isHomeForfeit) {
		homeScore = 0;
		awayScore = 3;
		homeStats.forfeits++;
	}

	if (result.isAwayForfeit) {
		homeScore = 3;
		awayScore = 0;
		awayStats.forfeits++;
	}

	const goalDiff = homeScore - awayScore;

	homeStats.played++;
	awayStats.played++;
	homeStats.goalsFor += homeScore;
	homeStats.goalsAgainst += awayScore;
	awayStats.goalsFor += awayScore;
	awayStats.goalsAgainst += homeScore;

	if (goalDiff > 0) {
		homeStats.won++;
		homeStats.points += 3;
		awayStats.lost++;
		homePoints = 3;
	} else if (goalDiff < 0) {
		homeStats.lost++;
		awayStats.won++;
		awayStats.points += 3;
		awayPoints = 3;
	} else {
		homeStats.drawn++;
		homeStats.points += 1;
		awayStats.drawn++;
		awayStats.points += 1;
		homePoints = 1;
		awayPoints = 1;
	}

	homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
	awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

	updateHeadToHead(homeStats, result.awayTeamId, homePoints, goalDiff);
	updateHeadToHead(awayStats, result.homeTeamId, awayPoints, -goalDiff);
}

function compareStandings(
	a: { stats: StandingStats; team: Team },
	b: { stats: StandingStats; team: Team },
	allStats: Map<string, { stats: StandingStats; team: Team }>
): number {
	if (a.team.isWithdrawn && !b.team.isWithdrawn) return 1;
	if (!a.team.isWithdrawn && b.team.isWithdrawn) return -1;

	if (a.stats.points !== b.stats.points) {
		return b.stats.points - a.stats.points;
	}

	if (a.stats.goalDifference !== b.stats.goalDifference) {
		return b.stats.goalDifference - a.stats.goalDifference;
	}

	if (a.stats.goalsFor !== b.stats.goalsFor) {
		return b.stats.goalsFor - a.stats.goalsFor;
	}

	const aH2h = a.stats.headToHead.get(b.team.id);
	const bH2h = b.stats.headToHead.get(a.team.id);

	if (aH2h && bH2h) {
		if (aH2h.points !== bH2h.points) {
			return bH2h.points - aH2h.points;
		}
		if (aH2h.goalDifference !== bH2h.goalDifference) {
			return bH2h.goalDifference - aH2h.goalDifference;
		}
	}

	return a.team.name.localeCompare(b.team.name);
}

export async function calculateStandings(
	seasonId: string,
	results?: MatchResult[]
): Promise<TeamStanding[]> {
	const teams = await getTeamsBySeason(seasonId);

	if (!results) {
		results = await getMatchResultsBySeason(seasonId);
	}

	const statsMap = new Map<string, { stats: StandingStats; team: Team }>();

	for (const team of teams) {
		statsMap.set(team.id, {
			stats: createEmptyStats(),
			team
		});
	}

	for (const result of results) {
		const homeEntry = statsMap.get(result.homeTeamId);
		const awayEntry = statsMap.get(result.awayTeamId);

		if (homeEntry && awayEntry) {
			processMatchResult(homeEntry.stats, awayEntry.stats, result);
		}
	}

	const sortedEntries = Array.from(statsMap.values()).sort((a, b) =>
		compareStandings(a, b, statsMap)
	);

	const standings: TeamStanding[] = sortedEntries.map((entry, index) => ({
		teamId: entry.team.id,
		teamName: entry.team.name,
		rank: index + 1,
		points: entry.stats.points,
		played: entry.stats.played,
		won: entry.stats.won,
		drawn: entry.stats.drawn,
		lost: entry.stats.lost,
		goalsFor: entry.stats.goalsFor,
		goalsAgainst: entry.stats.goalsAgainst,
		goalDifference: entry.stats.goalDifference,
		forfeits: entry.stats.forfeits,
		isWithdrawn: entry.team.isWithdrawn
	}));

	return standings;
}

export async function createRankingSnapshots(
	seasonId: string,
	matchResultId?: string
): Promise<RankingSnapshot[]> {
	const standings = await calculateStandings(seasonId);
	const timestamp = Date.now();

	const snapshots: RankingSnapshot[] = standings.map((standing) => ({
		id: generateId(),
		seasonId,
		teamId: standing.teamId,
		rank: standing.rank,
		points: standing.points,
		played: standing.played,
		won: standing.won,
		drawn: standing.drawn,
		lost: standing.lost,
		goalsFor: standing.goalsFor,
		goalsAgainst: standing.goalsAgainst,
		goalDifference: standing.goalDifference,
		forfeits: standing.forfeits,
		timestamp,
		matchResultId
	}));

	await saveRankingSnapshots(snapshots);

	return snapshots;
}

export async function getStandingsWithPreviousRank(
	seasonId: string
): Promise<TeamStanding[]> {
	const currentStandings = await calculateStandings(seasonId);

	const latestSnapshot = currentStandings.length > 0 ? currentStandings[0] : null;
	let previousSnapshots: RankingSnapshot[] = [];

	if (latestSnapshot) {
		previousSnapshots = await getRankingSnapshotsBefore(seasonId, Date.now() + 1);
	}

	const previousRankMap = new Map<string, number>();
	for (const snapshot of previousSnapshots) {
		previousRankMap.set(snapshot.teamId, snapshot.rank);
	}

	return currentStandings.map((standing) => ({
		...standing,
		previousRank: previousRankMap.get(standing.teamId)
	}));
}

export async function getTeamMatchImpacts(
	teamId: string,
	seasonId: string
): Promise<MatchImpact[]> {
	const results = await getMatchResultsBySeason(seasonId);
	const teams = await getTeamsBySeason(seasonId);
	const teamMap = new Map(teams.map((t) => [t.id, t]));

	const team = teamMap.get(teamId);
	if (!team) return [];

	const impacts: MatchImpact[] = [];
	let cumulativePoints = 0;

	for (const result of results) {
		const isHome = result.homeTeamId === teamId;
		const isAway = result.awayTeamId === teamId;

		if (!isHome && !isAway) continue;

		const opponentId = isHome ? result.awayTeamId : result.homeTeamId;
		const opponent = teamMap.get(opponentId);
		if (!opponent) continue;

		let homeScore = result.homeScore;
		let awayScore = result.awayScore;
		let pointsChange = 0;

		if (result.isHomeForfeit && result.isAwayForfeit) {
			pointsChange = 0;
		} else if (result.isHomeForfeit) {
			homeScore = 0;
			awayScore = 3;
		} else if (result.isAwayForfeit) {
			homeScore = 3;
			awayScore = 0;
		}

		const goalDiff = homeScore - awayScore;

		if (isHome) {
			if (result.isHomeForfeit && !result.isAwayForfeit) {
				pointsChange = 0;
			} else if (!result.isHomeForfeit && result.isAwayForfeit) {
				pointsChange = 3;
			} else if (goalDiff > 0) {
				pointsChange = 3;
			} else if (goalDiff < 0) {
				pointsChange = 0;
			} else {
				pointsChange = 1;
			}
		} else {
			if (result.isAwayForfeit && !result.isHomeForfeit) {
				pointsChange = 0;
			} else if (!result.isAwayForfeit && result.isHomeForfeit) {
				pointsChange = 3;
			} else if (goalDiff < 0) {
				pointsChange = 3;
			} else if (goalDiff > 0) {
				pointsChange = 0;
			} else {
				pointsChange = 1;
			}
		}

		cumulativePoints += pointsChange;

		const resultsUpToThis = results.slice(0, results.indexOf(result) + 1);
		const standingsAfter = await calculateStandings(seasonId, resultsUpToThis);
		const teamStanding = standingsAfter.find((s) => s.teamId === teamId);

		const fixture = await getFixtureById(result.fixtureId);

		impacts.push({
			matchResultId: result.id,
			opponentId,
			opponentName: opponent.name,
			homeScore,
			awayScore,
			isHome,
			pointsChange,
			pointsAfter: cumulativePoints,
			rankAfter: teamStanding?.rank || 0,
			matchDate: fixture?.matchDate || result.createdAt
		});
	}

	return impacts;
}

export function validateScore(
	homeScore: number,
	awayScore: number,
	isHomeForfeit: boolean,
	isAwayForfeit: boolean
): { valid: boolean; error?: string } {
	if (isHomeForfeit && isAwayForfeit) {
		return { valid: true };
	}

	if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
		return { valid: false, error: '比分必须是整数' };
	}

	if (homeScore < 0 || awayScore < 0) {
		return { valid: false, error: '比分不能为负数' };
	}

	if (homeScore > 99 || awayScore > 99) {
		return { valid: false, error: '比分不能超过99' };
	}

	if (isHomeForfeit || isAwayForfeit) {
		return { valid: true };
	}

	return { valid: true };
}
