import { json, error } from '@sveltejs/kit';
import { withdrawTeam, getTeamById } from '$lib/db';

export async function POST({ params }) {
	const { id } = params;

	const team = await getTeamById(id);
	if (!team) {
		return error(404, '队伍不存在');
	}

	const updatedTeam = await withdrawTeam(id);
	if (!updatedTeam) {
		return error(500, '退赛操作失败');
	}

	return json(updatedTeam);
}
