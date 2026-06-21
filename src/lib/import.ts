import type {
	ImportRow,
	ImportPreview,
	ImportTeamPreview,
	ImportFixturePreview,
	ImportResultPreview,
	ImportAction
} from './types';
import {
	db,
	saveDb,
	getSeasonById,
	getTeamsBySeason,
	getFixturesBySeason,
	getMatchResultsBySeason
} from './db';
import { validateScore, calculateStandingsFromData } from './ranking';
import type { Team, Fixture, MatchResult, RankingSnapshot } from './types';

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function parseImportText(text: string): ImportRow[] {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	const rows: ImportRow[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const parts = line.split(/\t/).map((p) => p.trim());

		if (parts.length < 3) continue;

		const roundStr = parts[0];
		const homeTeamName = parts[1];
		const awayTeamName = parts[2];

		const round = parseInt(roundStr, 10);
		if (isNaN(round) || round < 1) continue;
		if (!homeTeamName || !awayTeamName) continue;
		if (homeTeamName === awayTeamName) continue;

		let homeScore: number | undefined;
		let awayScore: number | undefined;
		let isHomeForfeit = false;
		let isAwayForfeit = false;
		let hasResult = false;

		const scoreStr = parts[3] ?? '';
		const awayScoreStr = parts[4] ?? '';
		const note = (parts[5] ?? '').toLowerCase();

		if (note.includes('双方弃权')) {
			isHomeForfeit = true;
			isAwayForfeit = true;
			hasResult = true;
			homeScore = 0;
			awayScore = 0;
		} else if (note.includes('主队弃权') || note.includes('主场弃权')) {
			isHomeForfeit = true;
			isAwayForfeit = false;
			hasResult = true;
			homeScore = 0;
			awayScore = 3;
		} else if (note.includes('客队弃权') || note.includes('客场弃权')) {
			isHomeForfeit = false;
			isAwayForfeit = true;
			hasResult = true;
			homeScore = 3;
			awayScore = 0;
		} else if (scoreStr !== '' && awayScoreStr !== '') {
			homeScore = parseInt(scoreStr, 10);
			awayScore = parseInt(awayScoreStr, 10);
			if (!isNaN(homeScore) && !isNaN(awayScore)) {
				hasResult = true;
			}
		}

		rows.push({
			lineNumber: i + 1,
			round,
			homeTeamName,
			awayTeamName,
			homeScore,
			awayScore,
			isHomeForfeit,
			isAwayForfeit,
			hasResult,
			raw: line
		});
	}

	return rows;
}

export async function generatePreview(
	seasonId: string,
	rows: ImportRow[]
): Promise<ImportPreview> {
	const season = await getSeasonById(seasonId);
	if (!season) {
		return {
			teams: [],
			fixtures: [],
			results: [],
			summary: {
				teamsNew: 0,
				teamsSkipped: 0,
				teamsError: 0,
				fixturesNew: 0,
				fixturesSkipped: 0,
				fixturesError: 0,
				resultsNew: 0,
				resultsSkipped: 0,
				resultsError: 0
			},
			canProceed: false
		};
	}

	const existingTeams = await getTeamsBySeason(seasonId);
	const existingFixtures = await getFixturesBySeason(seasonId);
	const existingResults = await getMatchResultsBySeason(seasonId);

	const teamNameToId = new Map<string, string>();
	for (const t of existingTeams) {
		if (!t.isWithdrawn) {
			teamNameToId.set(t.name.toLowerCase(), t.id);
		}
	}

	const withdrawnTeamNames = new Set<string>();
	for (const t of existingTeams) {
		if (t.isWithdrawn) {
			withdrawnTeamNames.add(t.name.toLowerCase());
		}
	}

	const fixtureSet = new Set<string>();
	for (const f of existingFixtures) {
		fixtureSet.add(`${f.round}:${f.homeTeamId}:${f.awayTeamId}`);
		fixtureSet.add(`${f.round}:${f.awayTeamId}:${f.homeTeamId}`);
	}

	const resultFixtureIds = new Set<string>();
	for (const r of existingResults) {
		resultFixtureIds.add(r.fixtureId);
	}

	const newTeamNames = new Set<string>();
	for (const row of rows) {
		const homeLower = row.homeTeamName.toLowerCase();
		const awayLower = row.awayTeamName.toLowerCase();
		if (!teamNameToId.has(homeLower) && !newTeamNames.has(homeLower) && !withdrawnTeamNames.has(homeLower)) {
			newTeamNames.add(homeLower);
		}
		if (!teamNameToId.has(awayLower) && !newTeamNames.has(awayLower) && !withdrawnTeamNames.has(awayLower)) {
			newTeamNames.add(awayLower);
		}
	}

	const teamPreviews: ImportTeamPreview[] = [];

	for (const name of newTeamNames) {
		if (withdrawnTeamNames.has(name)) {
			const originalTeam = existingTeams.find(
				(t) => t.name.toLowerCase() === name && t.isWithdrawn
			);
			teamPreviews.push({
				name: originalTeam?.name || name,
				action: 'error',
				reason: '该队伍已退赛，无法参赛'
			});
		} else if (teamNameToId.has(name)) {
			teamPreviews.push({
				name,
				action: 'skip',
				reason: '队伍已存在'
			});
		} else {
			teamPreviews.push({
				name,
				action: 'create',
				reason: '新建队伍'
			});
		}
	}

	const importTeamIds = new Map<string, string>();
	for (const t of existingTeams) {
		if (!t.isWithdrawn) {
			importTeamIds.set(t.name.toLowerCase(), t.id);
		}
	}
	for (const name of newTeamNames) {
		if (!withdrawnTeamNames.has(name)) {
			importTeamIds.set(name, `new-${name}`);
		}
	}

	const newFixtureKeys = new Set<string>();
	const fixturePreviews: ImportFixturePreview[] = [];
	const resultPreviews: ImportResultPreview[] = [];

	for (const row of rows) {
		const homeLower = row.homeTeamName.toLowerCase();
		const awayLower = row.awayTeamName.toLowerCase();

		const homeId = importTeamIds.get(homeLower);
		const awayId = importTeamIds.get(awayLower);

		if (!homeId) {
			if (withdrawnTeamNames.has(homeLower)) {
				fixturePreviews.push({
					round: row.round,
					homeTeamName: row.homeTeamName,
					awayTeamName: row.awayTeamName,
					action: 'error',
					reason: `主队"${row.homeTeamName}"已退赛`,
					lineNumber: row.lineNumber
				});
			} else {
				fixturePreviews.push({
					round: row.round,
					homeTeamName: row.homeTeamName,
					awayTeamName: row.awayTeamName,
					action: 'error',
					reason: `主队"${row.homeTeamName}"不存在`,
					lineNumber: row.lineNumber
				});
			}
			continue;
		}

		if (!awayId) {
			if (withdrawnTeamNames.has(awayLower)) {
				fixturePreviews.push({
					round: row.round,
					homeTeamName: row.homeTeamName,
					awayTeamName: row.awayTeamName,
					action: 'error',
					reason: `客队"${row.awayTeamName}"已退赛`,
					lineNumber: row.lineNumber
				});
			} else {
				fixturePreviews.push({
					round: row.round,
					homeTeamName: row.homeTeamName,
					awayTeamName: row.awayTeamName,
					action: 'error',
					reason: `客队"${row.awayTeamName}"不存在`,
					lineNumber: row.lineNumber
				});
			}
			continue;
		}

		const fixtureKey = `${row.round}:${homeId}:${awayId}`;
		const fixtureKeyReverse = `${row.round}:${awayId}:${homeId}`;
		const isNewTeamConflict =
			(homeId.startsWith('new-') || awayId.startsWith('new-')) &&
			newFixtureKeys.has(fixtureKeyReverse);

		let fixtureAction: ImportAction = 'create';
		let fixtureReason = '新建赛程';
		let isFixtureError = false;

		if (fixtureSet.has(fixtureKey) || fixtureSet.has(fixtureKeyReverse)) {
			fixtureAction = 'skip';
			fixtureReason = '赛程已存在';
		} else if (newFixtureKeys.has(fixtureKey) || isNewTeamConflict) {
			fixtureAction = 'error';
			fixtureReason = '本批次内重复赛程';
			isFixtureError = true;
		}

		if (!isFixtureError) {
			newFixtureKeys.add(fixtureKey);
		}

		fixturePreviews.push({
			round: row.round,
			homeTeamName: row.homeTeamName,
			awayTeamName: row.awayTeamName,
			action: fixtureAction,
			reason: fixtureReason,
			lineNumber: row.lineNumber
		});

		if (row.hasResult && fixtureAction !== 'error') {
			let resultAction: ImportAction = 'create';
			let resultReason = '录入结果';

			const existingFixture = existingFixtures.find(
				(f) =>
					f.round === row.round &&
					((f.homeTeamId === homeId && f.awayTeamId === awayId) ||
						(f.homeTeamId === awayId && f.awayTeamId === homeId))
			);

			if (existingFixture && resultFixtureIds.has(existingFixture.id)) {
				resultAction = 'skip';
				resultReason = '该赛程已有结果';
			} else if (fixtureAction === 'skip') {
				const existingF = existingFixtures.find(
					(f) =>
						f.round === row.round &&
						((f.homeTeamId === homeId && f.awayTeamId === awayId) ||
							(f.homeTeamId === awayId && f.awayTeamId === homeId))
				);
				if (existingF && resultFixtureIds.has(existingF.id)) {
					resultAction = 'skip';
					resultReason = '该赛程已有结果';
				}
			}

			if (resultAction === 'create') {
				const validation = validateScore(
					row.homeScore ?? 0,
					row.awayScore ?? 0,
					row.isHomeForfeit,
					row.isAwayForfeit
				);
				if (!validation.valid) {
					resultAction = 'error';
					resultReason = validation.error || '比分无效';
				}
			}

			resultPreviews.push({
				round: row.round,
				homeTeamName: row.homeTeamName,
				awayTeamName: row.awayTeamName,
				homeScore: row.homeScore ?? 0,
				awayScore: row.awayScore ?? 0,
				isHomeForfeit: row.isHomeForfeit,
				isAwayForfeit: row.isAwayForfeit,
				action: resultAction,
				reason: resultReason,
				lineNumber: row.lineNumber
			});
		} else if (row.hasResult && fixtureAction === 'error') {
			resultPreviews.push({
				round: row.round,
				homeTeamName: row.homeTeamName,
				awayTeamName: row.awayTeamName,
				homeScore: row.homeScore ?? 0,
				awayScore: row.awayScore ?? 0,
				isHomeForfeit: row.isHomeForfeit,
				isAwayForfeit: row.isAwayForfeit,
				action: 'error',
				reason: '对应赛程失败，结果无法录入',
				lineNumber: row.lineNumber
			});
		}
	}

	const summary = {
		teamsNew: teamPreviews.filter((t) => t.action === 'create').length,
		teamsSkipped: teamPreviews.filter((t) => t.action === 'skip').length,
		teamsError: teamPreviews.filter((t) => t.action === 'error').length,
		fixturesNew: fixturePreviews.filter((f) => f.action === 'create').length,
		fixturesSkipped: fixturePreviews.filter((f) => f.action === 'skip').length,
		fixturesError: fixturePreviews.filter((f) => f.action === 'error').length,
		resultsNew: resultPreviews.filter((r) => r.action === 'create').length,
		resultsSkipped: resultPreviews.filter((r) => r.action === 'skip').length,
		resultsError: resultPreviews.filter((r) => r.action === 'error').length
	};

	const canProceed =
		season &&
		!season.isArchived &&
		(summary.teamsNew > 0 || summary.fixturesNew > 0 || summary.resultsNew > 0) &&
		summary.teamsError === 0 &&
		summary.fixturesError === 0 &&
		summary.resultsError === 0;

	return {
		teams: teamPreviews,
		fixtures: fixturePreviews,
		results: resultPreviews,
		summary,
		canProceed: !!canProceed
	};
}

export async function executeImport(
	seasonId: string,
	rows: ImportRow[],
	preview: ImportPreview
): Promise<{ success: boolean; teamsCreated: number; fixturesCreated: number; resultsCreated: number; message: string }> {
	const season = await getSeasonById(seasonId);
	if (!season || season.isArchived) {
		return { success: false, teamsCreated: 0, fixturesCreated: 0, resultsCreated: 0, message: '赛季不存在或已归档' };
	}

	await db.read();
	const backup = JSON.parse(JSON.stringify(db.data));

	try {
		const existingTeams = db.data!.teams.filter((t) => t.seasonId === seasonId);
		const teamNameToId = new Map<string, string>();
		for (const t of existingTeams) {
			if (!t.isWithdrawn) {
				teamNameToId.set(t.name.toLowerCase(), t.id);
			}
		}

		for (const teamPreview of preview.teams) {
			if (teamPreview.action !== 'create') continue;
			const nameLower = teamPreview.name.toLowerCase();
			if (teamNameToId.has(nameLower)) continue;

			const newTeam: Team = {
				id: generateId(),
				seasonId,
				name: teamPreview.name,
				isWithdrawn: false,
				createdAt: Date.now()
			};
			db.data!.teams.push(newTeam);
			teamNameToId.set(nameLower, newTeam.id);
		}

		const existingFixtures = db.data!.fixtures.filter((f) => f.seasonId === seasonId);
		const fixtureLookup = new Map<string, Fixture>();
		for (const f of existingFixtures) {
			fixtureLookup.set(`${f.round}:${f.homeTeamId}:${f.awayTeamId}`, f);
			fixtureLookup.set(`${f.round}:${f.awayTeamId}:${f.homeTeamId}`, f);
		}

		const existingResults = db.data!.matchResults;
		const resultFixtureIds = new Set<string>();
		for (const r of existingResults) {
			resultFixtureIds.add(r.fixtureId);
		}

		const createdFixtures: Fixture[] = [];
		const createdResults: MatchResult[] = [];

		for (const row of rows) {
			const homeId = teamNameToId.get(row.homeTeamName.toLowerCase());
			const awayId = teamNameToId.get(row.awayTeamName.toLowerCase());

			if (!homeId || !awayId) continue;

			const fixturePreview = preview.fixtures.find(
				(p) => p.lineNumber === row.lineNumber
			);
			if (!fixturePreview || fixturePreview.action === 'error') continue;

			let fixture: Fixture | undefined;

			if (fixturePreview.action === 'skip') {
				const key1 = `${row.round}:${homeId}:${awayId}`;
				const key2 = `${row.round}:${awayId}:${homeId}`;
				fixture = fixtureLookup.get(key1) || fixtureLookup.get(key2);
			} else if (fixturePreview.action === 'create') {
				const key1 = `${row.round}:${homeId}:${awayId}`;
				const key2 = `${row.round}:${awayId}:${homeId}`;
				const existing = fixtureLookup.get(key1) || fixtureLookup.get(key2);

				if (existing) {
					fixture = existing;
				} else {
					fixture = {
						id: generateId(),
						seasonId,
						homeTeamId: homeId,
						awayTeamId: awayId,
						matchDate: Date.now(),
						round: row.round,
						createdAt: Date.now()
					};
					db.data!.fixtures.push(fixture);
					fixtureLookup.set(`${row.round}:${homeId}:${awayId}`, fixture);
					fixtureLookup.set(`${row.round}:${awayId}:${homeId}`, fixture);
					createdFixtures.push(fixture);
				}
			}

			if (!fixture) continue;

			if (row.hasResult) {
				const resultPreview = preview.results.find(
					(p) => p.lineNumber === row.lineNumber
				);
				if (!resultPreview || resultPreview.action !== 'create') continue;

				if (resultFixtureIds.has(fixture.id)) continue;

				const matchResult: MatchResult = {
					id: generateId(),
					fixtureId: fixture.id,
					seasonId,
					homeTeamId: fixture.homeTeamId,
					awayTeamId: fixture.awayTeamId,
					homeScore: row.homeScore ?? 0,
					awayScore: row.awayScore ?? 0,
					isHomeForfeit: row.isHomeForfeit,
					isAwayForfeit: row.isAwayForfeit,
					createdAt: Date.now()
				};
				db.data!.matchResults.push(matchResult);
				resultFixtureIds.add(fixture.id);
				createdResults.push(matchResult);
			}
		}

		db.data!.rankingSnapshots = db.data!.rankingSnapshots.filter(
			(s) => s.seasonId !== seasonId
		);

		const allResults = db.data!.matchResults
			.filter((r) => r.seasonId === seasonId)
			.sort((a, b) => a.createdAt - b.createdAt);
		const allTeams = db.data!.teams.filter((t) => t.seasonId === seasonId);

		for (let i = 0; i < allResults.length; i++) {
			const result = allResults[i];
			const resultsUpToThis = allResults.slice(0, i + 1);
			const standings = calculateStandingsFromData(allTeams, resultsUpToThis);
			const timestamp = result.createdAt;

			for (const standing of standings) {
				const snapshot: RankingSnapshot = {
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
					matchResultId: result.id
				};
				db.data!.rankingSnapshots.push(snapshot);
			}
		}

		await saveDb();

		return {
			success: true,
			teamsCreated: preview.summary.teamsNew,
			fixturesCreated: createdFixtures.length,
			resultsCreated: createdResults.length,
			message: `导入成功：新建 ${preview.summary.teamsNew} 支队伍，${createdFixtures.length} 场赛程，${createdResults.length} 条结果`
		};
	} catch (e) {
		db.data = backup;
		await saveDb();
		return {
			success: false,
			teamsCreated: 0,
			fixturesCreated: 0,
			resultsCreated: 0,
			message: `导入失败，已回滚：${e instanceof Error ? e.message : '未知错误'}`
		};
	}
}
