import { json, error } from '@sveltejs/kit';
import { getTeamMatchImpacts } from '$lib/ranking';

export async function GET({ params, url }) {
	const { id } = params;
	const seasonId = url.searchParams.get('seasonId');

	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const impacts = await getTeamMatchImpacts(id, seasonId);
	return json(impacts);
}
