import { json, error } from '@sveltejs/kit';
import { getSeasons, createSeason } from '$lib/db';

export async function GET() {
	const seasons = await getSeasons();
	return json(seasons);
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
		return error(400, '赛季名称不能为空');
	}

	const season = await createSeason(data.name.trim());
	return json(season);
}
