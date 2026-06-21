import { json, error } from '@sveltejs/kit';
import { getFixturesBySeason, createFixture } from '$lib/db';

export async function GET({ url }) {
	const seasonId = url.searchParams.get('seasonId');
	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const fixtures = await getFixturesBySeason(seasonId);
	return json(fixtures);
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.seasonId || !data.homeTeamId || !data.awayTeamId || !data.matchDate || !data.round) {
		return error(400, '缺少必要参数');
	}

	if (data.homeTeamId === data.awayTeamId) {
		return error(400, '主场和客场队伍不能相同');
	}

	const matchDate = typeof data.matchDate === 'number' ? data.matchDate : Date.now();
	const round = Number(data.round);

	if (!Number.isInteger(round) || round < 1) {
		return error(400, '轮次必须是正整数');
	}

	const fixture = await createFixture(
		data.seasonId,
		data.homeTeamId,
		data.awayTeamId,
		matchDate,
		round
	);

	if (!fixture) {
		return error(400, '创建赛程失败，可能是重复赛程或赛季已归档');
	}

	return json(fixture);
}
