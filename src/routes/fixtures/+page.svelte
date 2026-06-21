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
	import type { Fixture, MatchResult, Team, Season } from '$lib/types';

	let showAddFixture = $state(false);
	let showAddResult = $state(false);

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
					}}
				>
					{showAddFixture ? '取消' : '+ 添加赛程'}
				</button>
				<button
					class="btn btn-primary"
					onclick={() => {
						showAddResult = !showAddResult;
						showAddFixture = false;
					}}
				>
					{showAddResult ? '取消' : '+ 录入结果'}
				</button>
			</div>
		{/if}
	</div>

	{#if !$currentSeasonId}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">请先选择一个赛季</p>
		</div>
	{:else}
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
					<button class="btn btn-primary mt-4" onclick={() => (showAddFixture = true)}>
						添加赛程
					</button>
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
			</ul>
		</div>
	{/if}
</div>
