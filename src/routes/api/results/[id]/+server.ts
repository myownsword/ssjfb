import { json, error } from '@sveltejs/kit';
import {
	deleteMatchResult,
	getMatchResultById,
	getLatestMatchResult
} from '$lib/db';
import { getRankingSnapshotsBefore, deleteRankingSnapshotsAfter } from '$lib/db';

export async function DELETE({ params }) {
	const { id } = params;

	const result = await getMatchResultById(id);
	if (!result) {
		return error(404, '比赛结果不存在');
	}

	const latestResult = await getLatestMatchResult(result.seasonId);
	if (!latestResult || latestResult.id !== id) {
		return error(400, '只能撤回最近一次录入的比赛结果');
	}

	const timestamp = result.createdAt;
	await deleteRankingSnapshotsAfter(result.seasonId, timestamp);

	const success = await deleteMatchResult(id);
	if (!success) {
		return error(500, '撤回失败');
	}

	return json({ success: true });
}
