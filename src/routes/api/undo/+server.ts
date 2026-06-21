import { json, error } from '@sveltejs/kit';
import { getLatestMatchResult, deleteMatchResult } from '$lib/db';

export async function POST({ request }) {
	const data = await request.json();
	const seasonId = data.seasonId;

	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const latestResult = await getLatestMatchResult(seasonId);
	if (!latestResult) {
		return error(400, '没有可撤回的比赛结果');
	}

	const success = await deleteMatchResult(latestResult.id);
	if (!success) {
		return error(500, '撤回失败');
	}

	return json({ success: true, deletedResult: latestResult });
}
