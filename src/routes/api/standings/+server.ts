import { json, error } from '@sveltejs/kit';
import { getStandingsWithPreviousRank, calculateStandings } from '$lib/ranking';

export async function GET({ url }) {
	const seasonId = url.searchParams.get('seasonId');
	if (!seasonId) {
		return error(400, '缺少赛季ID');
	}

	const includePrevious = url.searchParams.get('includePrevious') !== 'false';

	let standings;
	if (includePrevious) {
		standings = await getStandingsWithPreviousRank(seasonId);
	} else {
		standings = await calculateStandings(seasonId);
	}

	return json(standings);
}
