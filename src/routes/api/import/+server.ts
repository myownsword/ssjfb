import { json, error } from '@sveltejs/kit';
import { getSeasonById } from '$lib/db';
import { parseImportText, generatePreview, executeImport } from '$lib/import';

export async function POST({ request }) {
	const data = await request.json();

	if (!data.seasonId) {
		return error(400, '缺少赛季ID');
	}

	if (!data.mode || (data.mode !== 'preview' && data.mode !== 'commit')) {
		return error(400, '缺少模式参数，须为 preview 或 commit');
	}

	const season = await getSeasonById(data.seasonId);
	if (!season) {
		return error(400, '赛季不存在');
	}

	if (season.isArchived) {
		return error(400, '归档赛季禁止导入');
	}

	if (!data.text && data.mode === 'preview') {
		return error(400, '缺少导入文本');
	}

	if (data.mode === 'preview') {
		const rows = parseImportText(data.text);
		if (rows.length === 0) {
			return error(400, '未解析到有效数据行，请检查格式');
		}

		const preview = await generatePreview(data.seasonId, rows);
		return json({ mode: 'preview', preview, rows });
	}

	if (!data.rows || !data.preview) {
		return error(400, '缺少导入数据或预检结果');
	}

	const result = await executeImport(data.seasonId, data.rows, data.preview);
	if (!result.success) {
		return error(400, result.message);
	}

	return json({ mode: 'commit', result });
}
