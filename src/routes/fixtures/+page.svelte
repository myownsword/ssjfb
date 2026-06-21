<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentSeasonId,
		teams,
		fixtures,
		matchResults,
		seasons,
		showError,
		showSuccess
	} from '$lib/stores';
	import type { Fixture, MatchResult, Team, ImportPreview, ImportRow } from '$lib/types';

	let showAddFixture = $state(false);
	let showAddResult = $state(false);
	let showImport = $state(false);

	let newFixture = $state({
		homeTeamId: '',
		awayTeamId: '',
		matchDate: '',
		round: 1
	});

	let newResult = $state({
		fixtureId: '',
		homeScore: 0,
		awayScore: 0,
		isHomeForfeit: false,
		isAwayForfeit: false
	});

	let isCreatingFixture = $state(false);
	let isCreatingResult = $state(false);

	let importText = $state('');
	let importPreview = $state<ImportPreview | null>(null);
	let importRows = $state<ImportRow[]>([]);
	let isImportPreviewing = $state(false);
	let isImportCommitting = $state(false);

	async function loadData() {
		if (!$currentSeasonId) return;

		try {
			const [teamsRes, fixturesRes, resultsRes] = await Promise.all([
				fetch(`/api/teams?seasonId=${$currentSeasonId}`),
				fetch(`/api/fixtures?seasonId=${$currentSeasonId}`),
				fetch(`/api/results?seasonId=${$currentSeasonId}`)
			]);

			if (teamsRes.ok) teams.set(await teamsRes.json());
			if (fixturesRes.ok) fixtures.set(await fixturesRes.json());
			if (resultsRes.ok) matchResults.set(await resultsRes.json());
		} catch (e) {
			showError('加载数据失败');
		}
	}

	async function createFixture(e: Event) {
		e.preventDefault();
		if (!$currentSeasonId) return;

		if (!newFixture.homeTeamId || !newFixture.awayTeamId) {
			showError('请选择主场和客场队伍');
			return;
		}

		if (newFixture.homeTeamId === newFixture.awayTeamId) {
			showError('主场和客场队伍不能相同');
			return;
		}

		if (!newFixture.round || newFixture.round < 1) {
			showError('请输入有效的轮次');
			return;
		}

		isCreatingFixture = true;
		try {
			const matchDate = newFixture.matchDate
				? new Date(newFixture.matchDate).getTime()
				: Date.now();

			const res = await fetch('/api/fixtures', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seasonId: $currentSeasonId,
					homeTeamId: newFixture.homeTeamId,
					awayTeamId: newFixture.awayTeamId,
					matchDate,
					round: newFixture.round
				})
			});

			if (res.ok) {
				showSuccess('赛程创建成功');
				newFixture = {
					homeTeamId: '',
					awayTeamId: '',
					matchDate: '',
					round: 1
				};
				showAddFixture = false;
				await loadData();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('创建赛程失败');
		} finally {
			isCreatingFixture = false;
		}
	}

	async function createResult(e: Event) {
		e.preventDefault();
		if (!$currentSeasonId) return;

		if (!newResult.fixtureId) {
			showError('请选择赛程');
			return;
		}

		if (!newResult.isHomeForfeit && !newResult.isAwayForfeit) {
			if (newResult.homeScore < 0 || newResult.awayScore < 0) {
				showError('比分不能为负数');
				return;
			}
			if (!Number.isInteger(newResult.homeScore) || !Number.isInteger(newResult.awayScore)) {
				showError('比分必须是整数');
				return;
			}
			if (newResult.homeScore > 99 || newResult.awayScore > 99) {
				showError('比分不能超过99');
				return;
			}
		}

		isCreatingResult = true;
		try {
			const res = await fetch('/api/results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newResult)
			});

			if (res.ok) {
				showSuccess('比赛结果录入成功');
				newResult = {
					fixtureId: '',
					homeScore: 0,
					awayScore: 0,
					isHomeForfeit: false,
					isAwayForfeit: false
				};
				showAddResult = false;
				await loadData();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('录入比赛结果失败');
		} finally {
			isCreatingResult = false;
		}
	}

	async function previewImport() {
		if (!$currentSeasonId || !importText.trim()) {
			showError('请输入导入内容');
			return;
		}

		isImportPreviewing = true;
		importPreview = null;
		try {
			const res = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seasonId: $currentSeasonId,
					mode: 'preview',
					text: importText
				})
			});

			if (res.ok) {
				const data = await res.json();
				importPreview = data.preview;
				importRows = data.rows || [];
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('预检失败');
		} finally {
			isImportPreviewing = false;
		}
	}

	async function commitImport() {
		if (!$currentSeasonId || !importPreview) return;

		isImportCommitting = true;
		try {
			const res = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seasonId: $currentSeasonId,
					mode: 'commit',
					rows: importRows,
					preview: importPreview
				})
			});

			if (res.ok) {
				const data = await res.json();
				showSuccess(data.result.message);
				importPreview = null;
				importText = '';
				importRows = [];
				showImport = false;
				await loadData();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('导入提交失败');
		} finally {
			isImportCommitting = false;
		}
	}

	function cancelImport() {
		showImport = false;
		importText = '';
		importPreview = null;
		importRows = [];
	}

	const currentSeason = $derived($seasons.find((s) => s.id === $currentSeasonId));

	const canEdit = $derived(!!(currentSeason && !currentSeason.isArchived));

	const activeTeams = $derived<Team[]>($teams.filter((t) => !t.isWithdrawn));

	const fixturesWithoutResult = $derived<Fixture[]>($fixtures.filter(
		(f) => !$matchResults.some((r) => r.fixtureId === f.id)
	));

	$effect(() => {
		if ($currentSeasonId) {
			loadData();
		}
	});

	onMount(() => {
		if ($currentSeasonId) {
			loadData();
		}
	});

	function getTeamName(teamId: string): string {
		const team = $teams.find((t) => t.id === teamId);
		return team?.name || '未知队伍';
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString('zh-CN');
	}

	function getResultForFixture(fixtureId: string): MatchResult | undefined {
		return $matchResults.find((r) => r.fixtureId === fixtureId);
	}

	function getDisplayScore(result: MatchResult): string {
		let homeScore = result.homeScore;
		let awayScore = result.awayScore;

		if (result.isHomeForfeit && !result.isAwayForfeit) {
			return '0-3 (弃权)';
		}
		if (!result.isHomeForfeit && result.isAwayForfeit) {
			return '3-0 (弃权)';
		}
		if (result.isHomeForfeit && result.isAwayForfeit) {
			return '0-0 (双方弃权)';
		}

		return `${homeScore}-${awayScore}`;
	}

	function actionBadgeClass(action: string): string {
		if (action === 'create') return 'badge badge-success';
		if (action === 'skip') return 'badge badge-warning';
		return 'badge badge-danger';
	}

	function actionLabel(action: string): string {
		if (action === 'create') return '新增';
		if (action === 'skip') return '跳过';
		return '失败';
	}

	const groupedFixtures = $derived<Record<number, Fixture[]>>($fixtures.reduce((acc, fixture) => {
		const round = fixture.round;
		if (!acc[round]) acc[round] = [];
		acc[round].push(fixture);
		return acc;
	}, {} as Record<number, Fixture[]>));
</script>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-2xl font-bold text-gray-800">赛程与比赛结果</h2>
			<p class="text-muted">
				当前赛季: <span class="font-medium">{currentSeason?.name || '未选择'}</span>
				{#if currentSeason?.isArchived}
					<span class="badge badge-gray ml-2">已归档</span>
				{/if}
			</p>
		</div>

		{#if canEdit}
			<div class="flex gap-3">
				<button
					class="btn btn-secondary"
					onclick={() => {
						showAddFixture = !showAddFixture;
						showAddResult = false;
						showImport = false;
					}}
				>
					{showAddFixture ? '取消' : '+ 添加赛程'}
				</button>
				<button
					class="btn btn-primary"
					onclick={() => {
						showAddResult = !showAddResult;
						showAddFixture = false;
						showImport = false;
					}}
				>
					{showAddResult ? '取消' : '+ 录入结果'}
				</button>
				<button
					class="btn btn-warning"
					onclick={() => {
						showImport = !showImport;
						showAddFixture = false;
						showAddResult = false;
					}}
				>
					{showImport ? '取消' : '📋 批量导入'}
				</button>
			</div>
		{/if}
	</div>

	{#if !$currentSeasonId}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">请先选择一个赛季</p>
		</div>
	{:else}
		{#if canEdit && showImport}
			<div class="card">
				<h3 class="card-title">批量导入赛程与结果</h3>
				<p class="text-sm text-muted mb-4">
					从 Excel 或其他表格软件复制数据后粘贴到下方文本框。每行格式（Tab分隔）：<br>
					<strong>轮次[Tab]主队[Tab]客队[Tab]主队比分[Tab]客队比分[Tab]备注</strong><br>
					比分和备注列可选。备注可填：主队弃权 / 客队弃权 / 双方弃权。无比分则仅创建赛程。
				</p>

				<div class="form-group">
					<label for="importText">粘贴表格文本</label>
					<textarea
						id="importText"
						class="import-textarea"
						bind:value={importText}
						placeholder={"1\t队伍A\t队伍B\t3\t1\n1\t队伍C\t队伍D\t0\t2\t主队弃权\n2\t队伍A\t队伍C\n2\t队伍B\t队伍D\t1\t1"}
						rows="8"
					></textarea>
				</div>

				<div class="flex justify-end gap-3 mb-4">
					<button
						type="button"
						class="btn btn-secondary"
						onclick={cancelImport}
					>
						取消
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={previewImport}
						disabled={isImportPreviewing || !importText.trim()}
					>
						{isImportPreviewing ? '预检中...' : '预检'}
					</button>
				</div>

				{#if importPreview}
					<div class="import-preview">
						<h4 class="text-lg font-semibold mb-3">预检结果</h4>

						<div class="import-summary">
							<div class="import-summary-item">
								<span class="import-summary-label">队伍</span>
								<span class="badge badge-success">新增 {importPreview.summary.teamsNew}</span>
								<span class="badge badge-warning">跳过 {importPreview.summary.teamsSkipped}</span>
								<span class="badge badge-danger">失败 {importPreview.summary.teamsError}</span>
							</div>
							<div class="import-summary-item">
								<span class="import-summary-label">赛程</span>
								<span class="badge badge-success">新增 {importPreview.summary.fixturesNew}</span>
								<span class="badge badge-warning">跳过 {importPreview.summary.fixturesSkipped}</span>
								<span class="badge badge-danger">失败 {importPreview.summary.fixturesError}</span>
							</div>
							<div class="import-summary-item">
								<span class="import-summary-label">结果</span>
								<span class="badge badge-success">新增 {importPreview.summary.resultsNew}</span>
								<span class="badge badge-warning">跳过 {importPreview.summary.resultsSkipped}</span>
								<span class="badge badge-danger">失败 {importPreview.summary.resultsError}</span>
							</div>
						</div>

						{#if importPreview.teams.length > 0}
							<div class="mt-4">
								<h5 class="font-medium mb-2">队伍变更</h5>
								<div class="import-preview-table-wrap">
									<table class="import-preview-table">
										<thead>
											<tr>
												<th>队伍名称</th>
												<th>操作</th>
												<th>说明</th>
											</tr>
										</thead>
										<tbody>
											{#each importPreview.teams as team (team.name)}
												<tr class="import-row-{team.action}">
													<td>{team.name}</td>
													<td><span class={actionBadgeClass(team.action)}>{actionLabel(team.action)}</span></td>
													<td>{team.reason}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}

						{#if importPreview.fixtures.length > 0}
							<div class="mt-4">
								<h5 class="font-medium mb-2">赛程变更</h5>
								<div class="import-preview-table-wrap">
									<table class="import-preview-table">
										<thead>
											<tr>
												<th>行号</th>
												<th>轮次</th>
												<th>主队</th>
												<th>客队</th>
												<th>操作</th>
												<th>说明</th>
											</tr>
										</thead>
										<tbody>
											{#each importPreview.fixtures as fixture (fixture.lineNumber)}
												<tr class="import-row-{fixture.action}">
													<td>{fixture.lineNumber}</td>
													<td>{fixture.round}</td>
													<td>{fixture.homeTeamName}</td>
													<td>{fixture.awayTeamName}</td>
													<td><span class={actionBadgeClass(fixture.action)}>{actionLabel(fixture.action)}</span></td>
													<td>{fixture.reason}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}

						{#if importPreview.results.length > 0}
							<div class="mt-4">
								<h5 class="font-medium mb-2">结果变更</h5>
								<div class="import-preview-table-wrap">
									<table class="import-preview-table">
										<thead>
											<tr>
												<th>行号</th>
												<th>轮次</th>
												<th>主队</th>
												<th>比分</th>
												<th>客队</th>
												<th>操作</th>
												<th>说明</th>
											</tr>
										</thead>
										<tbody>
											{#each importPreview.results as result (result.lineNumber)}
												<tr class="import-row-{result.action}">
													<td>{result.lineNumber}</td>
													<td>{result.round}</td>
													<td>{result.homeTeamName}</td>
													<td>
														{#if result.isHomeForfeit && result.isAwayForfeit}
															0-0 (双方弃权)
														{:else if result.isHomeForfeit}
															0-3 (主队弃权)
														{:else if result.isAwayForfeit}
															3-0 (客队弃权)
														{:else}
															{result.homeScore}-{result.awayScore}
														{/if}
													</td>
													<td>{result.awayTeamName}</td>
													<td><span class={actionBadgeClass(result.action)}>{actionLabel(result.action)}</span></td>
													<td>{result.reason}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}

						{#if !importPreview.canProceed}
							<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
								<p class="text-red-700 text-sm font-medium">
									存在失败项，请修正后重新预检。导入操作需要所有项均无错误才可提交。
								</p>
							</div>
						{/if}

						<div class="flex justify-end gap-3 mt-4">
							<button
								type="button"
								class="btn btn-secondary"
								onclick={() => { importPreview = null; }}
							>
								返回修改
							</button>
							<button
								type="button"
								class="btn btn-danger"
								onclick={commitImport}
								disabled={isImportCommitting || !importPreview.canProceed}
							>
								{isImportCommitting ? '提交中...' : '确认导入'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if canEdit && showAddFixture}
			<div class="card">
				<h3 class="card-title">添加赛程</h3>
				<form onsubmit={createFixture}>
					<div class="form-row">
						<div class="form-group">
							<label for="homeTeam">主场队伍</label>
							<select
								id="homeTeam"
								bind:value={newFixture.homeTeamId}
								required
							>
								<option value="">请选择主场队伍</option>
								{#each activeTeams as team (team.id)}
									<option value={team.id}>{team.name}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="awayTeam">客场队伍</label>
							<select
								id="awayTeam"
								bind:value={newFixture.awayTeamId}
								required
							>
								<option value="">请选择客场队伍</option>
								{#each activeTeams as team (team.id)}
									<option value={team.id}>{team.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label for="matchDate">比赛时间</label>
							<input
								id="matchDate"
								type="datetime-local"
								bind:value={newFixture.matchDate}
							/>
						</div>
						<div class="form-group">
							<label for="round">轮次</label>
							<input
								id="round"
								type="number"
								min="1"
								bind:value={newFixture.round}
								required
							/>
						</div>
					</div>
					<div class="flex justify-end gap-3">
						<button
							type="button"
							class="btn btn-secondary"
							onclick={() => (showAddFixture = false)}
						>
							取消
						</button>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={isCreatingFixture}
						>
							{isCreatingFixture ? '创建中...' : '创建赛程'}
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if canEdit && showAddResult}
			<div class="card">
				<h3 class="card-title">录入比赛结果</h3>
				<form onsubmit={createResult}>
					<div class="form-group">
						<label for="fixtureSelect">选择赛程</label>
						<select
							id="fixtureSelect"
							bind:value={newResult.fixtureId}
							required
						>
							<option value="">请选择赛程</option>
							{#each fixturesWithoutResult as fixture (fixture.id)}
								<option value={fixture.id}>
									第{fixture.round}轮 - {getTeamName(fixture.homeTeamId)} vs
									{getTeamName(fixture.awayTeamId)}
								</option>
							{:else}
								<option value="" disabled>暂无待录入结果的赛程</option>
							{/each}
						</select>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="homeScore">主场比分</label>
							<input
								id="homeScore"
								type="number"
								min="0"
								max="99"
								bind:value={newResult.homeScore}
								disabled={newResult.isHomeForfeit || newResult.isAwayForfeit}
								required={!newResult.isHomeForfeit && !newResult.isAwayForfeit}
							/>
						</div>
						<div class="form-group">
							<label for="awayScore">客场比分</label>
							<input
								id="awayScore"
								type="number"
								min="0"
								max="99"
								bind:value={newResult.awayScore}
								disabled={newResult.isHomeForfeit || newResult.isAwayForfeit}
								required={!newResult.isHomeForfeit && !newResult.isAwayForfeit}
							/>
						</div>
					</div>

					<div class="form-row">
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={newResult.isHomeForfeit}
							/>
							<span>主场队伍弃权</span>
						</label>
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={newResult.isAwayForfeit}
							/>
							<span>客场队伍弃权</span>
						</label>
					</div>

					<p class="text-sm text-muted mt-2">
						{#if newResult.isHomeForfeit && !newResult.isAwayForfeit}
							弃权方按 0-3 计算，积 0 分；对方积 3 分
						{:else if !newResult.isHomeForfeit && newResult.isAwayForfeit}
							弃权方按 0-3 计算，积 0 分；对方积 3 分
						{:else if newResult.isHomeForfeit && newResult.isAwayForfeit}
							双方均弃权，均不计分
						{/if}
					</p>

					<div class="flex justify-end gap-3 mt-4">
						<button
							type="button"
							class="btn btn-secondary"
							onclick={() => (showAddResult = false)}
						>
							取消
						</button>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={isCreatingResult || !newResult.fixtureId}
						>
							{isCreatingResult ? '录入中...' : '录入结果'}
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if Object.keys(groupedFixtures).length === 0}
			<div class="card text-center py-12">
				<p class="text-muted text-lg">暂无赛程</p>
				{#if canEdit}
					<div class="flex justify-center gap-3 mt-4">
						<button class="btn btn-primary" onclick={() => (showAddFixture = true)}>
							添加赛程
						</button>
						<button class="btn btn-warning" onclick={() => (showImport = true)}>
							批量导入
						</button>
					</div>
				{/if}
			</div>
		{:else}
			{#each Object.entries(groupedFixtures) as [round, roundFixtures]}
				<div class="card">
					<h3 class="card-title">第 {round} 轮</h3>
					<div class="space-y-3">
						{#each roundFixtures as fixture (fixture.id)}
							{@const result = getResultForFixture(fixture.id)}
							<div
								class="flex items-center justify-between p-4 bg-gray-50 rounded-lg {result
									? 'border-l-4 border-green-500'
									: 'border-l-4 border-gray-300'}"
							>
								<div class="flex-1">
									<div class="flex items-center gap-4">
										<span class="font-medium w-32 text-right">
											{getTeamName(fixture.homeTeamId)}
										</span>
										<span class="text-xl font-bold px-4 py-1 bg-white rounded min-w-[80px] text-center">
											{#if result}
												{getDisplayScore(result)}
											{:else}
												<span class="text-gray-400">VS</span>
											{/if}
										</span>
										<span class="font-medium w-32">
											{getTeamName(fixture.awayTeamId)}
										</span>
									</div>
									<div class="text-sm text-muted mt-1 ml-36">
										{formatDate(fixture.matchDate)}
										{#if result}
											<span class="ml-2 badge badge-success">已完赛</span>
										{:else}
											<span class="ml-2 badge badge-warning">待比赛</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}

		<div class="card bg-yellow-50">
			<h3 class="card-title text-yellow-800">注意事项</h3>
			<ul class="list-disc list-inside space-y-1 text-yellow-700 text-sm">
				<li>同一轮次中相同两支队伍的主客场对阵不能重复创建</li>
				<li>比分必须是 0-99 之间的整数</li>
				<li>弃权比赛系统会自动处理比分和积分</li>
				<li>录入结果后积分榜会自动更新</li>
				<li>可以在积分榜页面撤回最近一次录入的结果</li>
				<li>批量导入前须先预检，确认无失败项后才可提交</li>
				<li>批量导入为原子操作，任一行失败将回滚全部数据</li>
			</ul>
		</div>
	{/if}
</div>
