import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { Database, Season, Team, Fixture, MatchResult, RankingSnapshot } from './types';
import fs from 'fs';
import path from 'path';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

const dbFile = path.join(dbDir, 'db.json');

const defaultData: Database = {
	seasons: [],
	teams: [],
	fixtures: [],
	matchResults: [],
	rankingSnapshots: []
};

const adapter = new JSONFile<Database>(dbFile);
export const db = new Low<Database>(adapter, defaultData);

await db.read();

if (!db.data) {
	db.data = defaultData;
	await db.write();
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export async function saveDb(): Promise<void> {
	await db.write();
}

export async function createSeason(name: string): Promise<Season> {
	await db.read();
	const season: Season = {
		id: generateId(),
		name,
		createdAt: Date.now(),
		isArchived: false
	};
	db.data!.seasons.push(season);
	await saveDb();
	return season;
}

export async function getSeasons(): Promise<Season[]> {
	await db.read();
	return [...db.data!.seasons].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSeasonById(id: string): Promise<Season | undefined> {
	await db.read();
	return db.data!.seasons.find((s) => s.id === id);
}

export async function archiveSeason(seasonId: string): Promise<Season | undefined> {
	await db.read();
	const season = db.data!.seasons.find((s) => s.id === seasonId);
	if (season) {
		season.isArchived = true;
		season.archivedAt = Date.now();
		await saveDb();
	}
	return season;
}

export async function unarchiveSeason(seasonId: string): Promise<Season | undefined> {
	await db.read();
	const season = db.data!.seasons.find((s) => s.id === seasonId);
	if (season) {
		season.isArchived = false;
		delete season.archivedAt;
		await saveDb();
	}
	return season;
}

export async function createTeam(seasonId: string, name: string): Promise<Team | null> {
	await db.read();
	const season = db.data!.seasons.find((s) => s.id === seasonId);
	if (!season || season.isArchived) return null;

	const existingTeam = db.data!.teams.find(
		(t) => t.seasonId === seasonId && t.name.toLowerCase() === name.toLowerCase() && !t.isWithdrawn
	);
	if (existingTeam) return null;

	const team: Team = {
		id: generateId(),
		seasonId,
		name,
		isWithdrawn: false,
		createdAt: Date.now()
	};
	db.data!.teams.push(team);
	await saveDb();
	return team;
}

export async function getTeamsBySeason(seasonId: string): Promise<Team[]> {
	await db.read();
	return db.data!.teams
		.filter((t) => t.seasonId === seasonId)
		.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getTeamById(teamId: string): Promise<Team | undefined> {
	await db.read();
	return db.data!.teams.find((t) => t.id === teamId);
}

export async function withdrawTeam(teamId: string): Promise<Team | undefined> {
	await db.read();
	const team = db.data!.teams.find((t) => t.id === teamId);
	if (team && !team.isWithdrawn) {
		team.isWithdrawn = true;
		team.withdrawnAt = Date.now();
		await saveDb();
	}
	return team;
}

export async function createFixture(
	seasonId: string,
	homeTeamId: string,
	awayTeamId: string,
	matchDate: number,
	round: number
): Promise<Fixture | null> {
	await db.read();
	const season = db.data!.seasons.find((s) => s.id === seasonId);
	if (!season || season.isArchived) return null;

	const homeTeam = db.data!.teams.find((t) => t.id === homeTeamId && t.seasonId === seasonId);
	const awayTeam = db.data!.teams.find((t) => t.id === awayTeamId && t.seasonId === seasonId);

	if (!homeTeam || !awayTeam || homeTeamId === awayTeamId) return null;

	const existingFixture = db.data!.fixtures.find(
		(f) =>
			f.seasonId === seasonId &&
			f.round === round &&
			((f.homeTeamId === homeTeamId && f.awayTeamId === awayTeamId) ||
				(f.homeTeamId === awayTeamId && f.awayTeamId === homeTeamId))
	);
	if (existingFixture) return null;

	const fixture: Fixture = {
		id: generateId(),
		seasonId,
		homeTeamId,
		awayTeamId,
		matchDate,
		round,
		createdAt: Date.now()
	};
	db.data!.fixtures.push(fixture);
	await saveDb();
	return fixture;
}

export async function getFixturesBySeason(seasonId: string): Promise<Fixture[]> {
	await db.read();
	return db.data!.fixtures
		.filter((f) => f.seasonId === seasonId)
		.sort((a, b) => a.round - b.round || a.matchDate - b.matchDate);
}

export async function getFixtureById(fixtureId: string): Promise<Fixture | undefined> {
	await db.read();
	return db.data!.fixtures.find((f) => f.id === fixtureId);
}

export async function createMatchResult(
	fixtureId: string,
	homeScore: number,
	awayScore: number,
	isHomeForfeit: boolean = false,
	isAwayForfeit: boolean = false
): Promise<MatchResult | null> {
	await db.read();

	const fixture = db.data!.fixtures.find((f) => f.id === fixtureId);
	if (!fixture) return null;

	const season = db.data!.seasons.find((s) => s.id === fixture.seasonId);
	if (!season || season.isArchived) return null;

	const existingResult = db.data!.matchResults.find((r) => r.fixtureId === fixtureId);
	if (existingResult) return null;

	const matchResult: MatchResult = {
		id: generateId(),
		fixtureId,
		seasonId: fixture.seasonId,
		homeTeamId: fixture.homeTeamId,
		awayTeamId: fixture.awayTeamId,
		homeScore,
		awayScore,
		isHomeForfeit,
		isAwayForfeit,
		createdAt: Date.now()
	};

	db.data!.matchResults.push(matchResult);
	await saveDb();
	return matchResult;
}

export async function getMatchResultsBySeason(seasonId: string): Promise<MatchResult[]> {
	await db.read();
	return db.data!.matchResults
		.filter((r) => r.seasonId === seasonId)
		.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getMatchResultById(resultId: string): Promise<MatchResult | undefined> {
	await db.read();
	return db.data!.matchResults.find((r) => r.id === resultId);
}

export async function getLatestMatchResult(seasonId: string): Promise<MatchResult | undefined> {
	await db.read();
	const results = db.data!.matchResults
		.filter((r) => r.seasonId === seasonId)
		.sort((a, b) => b.createdAt - a.createdAt);
	return results[0];
}

export async function deleteMatchResult(resultId: string): Promise<boolean> {
	await db.read();
	const index = db.data!.matchResults.findIndex((r) => r.id === resultId);
	if (index === -1) return false;

	const result = db.data!.matchResults[index];
	const season = db.data!.seasons.find((s) => s.id === result.seasonId);
	if (season?.isArchived) return false;

	db.data!.matchResults.splice(index, 1);

	db.data!.rankingSnapshots = db.data!.rankingSnapshots.filter(
		(s) => s.matchResultId !== resultId
	);

	await saveDb();
	return true;
}

export async function saveRankingSnapshots(snapshots: RankingSnapshot[]): Promise<void> {
	await db.read();
	db.data!.rankingSnapshots.push(...snapshots);
	await saveDb();
}

export async function getRankingSnapshotsBySeason(seasonId: string): Promise<RankingSnapshot[]> {
	await db.read();
	return db.data!.rankingSnapshots
		.filter((s) => s.seasonId === seasonId)
		.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getLatestRankingSnapshots(
	seasonId: string
): Promise<RankingSnapshot[]> {
	await db.read();
	const snapshots = db.data!.rankingSnapshots
		.filter((s) => s.seasonId === seasonId)
		.sort((a, b) => b.timestamp - a.timestamp);

	if (snapshots.length === 0) return [];

	const latestTimestamp = snapshots[0].timestamp;
	return snapshots.filter((s) => s.timestamp === latestTimestamp);
}

export async function getRankingSnapshotsBefore(
	seasonId: string,
	timestamp: number
): Promise<RankingSnapshot[]> {
	await db.read();
	const snapshots = db.data!.rankingSnapshots
		.filter((s) => s.seasonId === seasonId && s.timestamp < timestamp)
		.sort((a, b) => b.timestamp - a.timestamp);

	if (snapshots.length === 0) return [];

	const latestTimestamp = snapshots[0].timestamp;
	return snapshots.filter((s) => s.timestamp === latestTimestamp);
}

export async function deleteRankingSnapshotsAfter(
	seasonId: string,
	timestamp: number
): Promise<void> {
	await db.read();
	db.data!.rankingSnapshots = db.data!.rankingSnapshots.filter(
		(s) => !(s.seasonId === seasonId && s.timestamp > timestamp)
	);
	await saveDb();
}
