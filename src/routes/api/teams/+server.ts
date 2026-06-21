import { json, error } from '@sveltejs/kit';
import { getTeamsBySeason, createTeam } from '$lib/db';

export async function GET({ url }) {
	const seasonId = url.searchParams.get('seasonId');
	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const teams = await getTeamsBySeason(seasonId);
	return json(teams);
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.seasonId || !data.name) {
		return error(400, '缺少必要参数');
	}

	if (typeof data.name !== 'string' || data.name.trim().length === 0) {
		return error(400, '队伍名称不能为空');
	}

	const team = await createTeam(data.seasonId, data.name.trim());
	if (!team) {
		return error(400, '创建队伍失败，可能是赛季已归档或队伍名称已存在');
	}

	return json(team);
}
