import { json, error } from '@sveltejs/kit';
import { getMatchResultsBySeason, createMatchResult, getLatestMatchResult } from '$lib/db';
import { validateScore, createRankingSnapshots } from '$lib/ranking';

export async function GET({ url }) {
	const seasonId = url.searchParams.get('seasonId');
	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const results = await getMatchResultsBySeason(seasonId);
	return json(results);
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.fixtureId) {
		return error(400, '缺少赛程ID');
	}

	const homeScore = Number(data.homeScore);
	const awayScore = Number(data.awayScore);
	const isHomeForfeit = Boolean(data.isHomeForfeit);
	const isAwayForfeit = Boolean(data.isAwayForfeit);

	const validation = validateScore(homeScore, awayScore, isHomeForfeit, isAwayForfeit);
	if (!validation.valid) {
		return error(400, validation.error || '比分无效');
	}

	const result = await createMatchResult(
		data.fixtureId,
		homeScore,
		awayScore,
		isHomeForfeit,
		isAwayForfeit
	);

	if (!result) {
		return error(400, '录入比赛结果失败，可能是赛程不存在或已有结果或赛季已归档');
	}

	await createRankingSnapshots(result.seasonId, result.id);

	return json(result);
}
