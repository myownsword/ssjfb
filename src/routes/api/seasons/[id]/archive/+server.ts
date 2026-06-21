import { json, error } from '@sveltejs/kit';
import { archiveSeason, unarchiveSeason, getSeasonById } from '$lib/db';

export async function POST({ params, request }) {
	const { id } = params;
	const data = await request.json();

	const season = await getSeasonById(id);
	if (!season) {
		return error(404, '赛季不存在');
	}

	let updatedSeason;
	if (data.archive) {
		updatedSeason = await archiveSeason(id);
	} else if (data.unarchive) {
		updatedSeason = await unarchiveSeason(id);
	} else {
		return error(400, '无效的操作');
	}

	if (!updatedSeason) {
		return error(500, '操作失败');
	}

	return json(updatedSeason);
}
