<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentSeasonId,
		standings,
		seasons,
		matchResults,
		isLoading,
		showError,
		showSuccess
	} from '$lib/stores';
	import type { TeamStanding, MatchResult, Season } from '$lib/types';
	import { goto } from '$app/navigation';

	let hasLoaded = $state(false);

	async function loadStandings() {
		if (!$currentSeasonId) return;

		isLoading.set(true);
		try {
			const res = await fetch(`/api/standings?seasonId=${$currentSeasonId}`);
			if (res.ok) {
				const data = await res.json();
				standings.set(data);
			} else {
				const err = await res.text();
				showError(err);
			}

			const resultsRes = await fetch(`/api/results?seasonId=${$currentSeasonId}`);
			if (resultsRes.ok) {
				const resultsData = await resultsRes.json();
				matchResults.set(resultsData);
			}
		} catch (e) {
			showError('加载积分榜失败');
		} finally {
			isLoading.set(false);
		}
	}

	async function undoLastResult() {
		if (!$currentSeasonId) return;

		if (!confirm('确定要撤回最近一次录入的比赛结果吗？')) return;

		try {
			const res = await fetch('/api/undo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ seasonId: $currentSeasonId })
			});

			if (res.ok) {
				showSuccess('已成功撤回最近一次比赛结果');
				await loadStandings();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('撤回失败');
		}
	}

	$effect(() => {
		if ($currentSeasonId && hasLoaded) {
			loadStandings();
		}
	});

	onMount(() => {
		hasLoaded = true;
		if ($currentSeasonId) {
			loadStandings();
		}
	});

	const currentSeason = $derived($seasons.find((s) => s.id === $currentSeasonId));

	const canUndo = $derived($matchResults.length > 0 && !currentSeason?.isArchived);

	const lastResult = $derived<MatchResult | null>($matchResults.length > 0 ? $matchResults[$matchResults.length - 1] : null);

	function getRankChange(standing: TeamStanding): string {
		if (standing.previousRank === undefined) {
			if ($matchResults.length > 0 && standing.played > 0) {
				return '新';
			}
			return '—';
		}
		const diff = standing.previousRank - standing.rank;
		if (diff > 0) return `↑${diff}`;
		if (diff < 0) return `↓${Math.abs(diff)}`;
		return '—';
	}

	function getRankChangeClass(standing: TeamStanding): string {
		if (standing.previousRank === undefined) {
			if ($matchResults.length > 0 && standing.played > 0) {
				return 'rank-new';
			}
			return 'rank-same';
		}
		const diff = standing.previousRank - standing.rank;
		if (diff > 0) return 'rank-up';
		if (diff < 0) return 'rank-down';
		return 'rank-same';
	}

	function getRankBadge(standing: TeamStanding): string {
		if (standing.rank === 1) return '🥇';
		if (standing.rank === 2) return '🥈';
		if (standing.rank === 3) return '🥉';
		return `${standing.rank}`;
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString('zh-CN');
	}

	function goToTeam(teamId: string) {
		goto(`/teams/${teamId}`);
	}
</script>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-2xl font-bold text-gray-800">积分榜</h2>
			<p class="text-muted">
				当前赛季: <span class="font-medium">{currentSeason?.name || '未选择'}</span>
				{#if currentSeason?.isArchived}
					<span class="badge badge-gray ml-2">已归档</span>
				{/if}
			</p>
		</div>

		<div class="flex gap-3">
			{#if lastResult}
				<div class="text-sm text-muted">
					最近录入: {formatDate(lastResult.createdAt)}
				</div>
			{/if}
			<button
				class="btn btn-warning"
				onclick={undoLastResult}
				disabled={!canUndo}
			>
				↩ 撤回最近结果
			</button>
			<button
				class="btn btn-primary"
				onclick={loadStandings}
				disabled={$isLoading || !$currentSeasonId}
			>
				{$isLoading ? '加载中...' : '刷新'}
			</button>
		</div>
	</div>

	{#if !$currentSeasonId}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">请先在赛季管理中创建一个赛季</p>
			<a href="/seasons" class="btn btn-primary mt-4 inline-block">去创建赛季</a>
		</div>
	{:else if $standings.length === 0}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">暂无队伍数据</p>
			<a href="/teams" class="btn btn-primary mt-4 inline-block">去添加队伍</a>
		</div>
	{:else}
		<div class="card overflow-hidden">
			<div class="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th class="w-16 text-center">排名</th>
							<th>队伍</th>
							<th class="text-center">场次</th>
							<th class="text-center">胜</th>
							<th class="text-center">平</th>
							<th class="text-center">负</th>
							<th class="text-center">进球</th>
							<th class="text-center">失球</th>
							<th class="text-center">净胜球</th>
							<th class="text-center">弃权</th>
							<th class="text-center">积分</th>
							<th class="text-center">升降</th>
						</tr>
					</thead>
					<tbody>
						{#each $standings as standing (standing.teamId)}
							<tr
								class="{standing.isWithdrawn ? 'bg-gray-50' : ''} cursor-pointer hover:bg-blue-50 transition-colors"
								onclick={() => goToTeam(standing.teamId)}
							>
								<td class="text-center font-bold text-lg">
									{getRankBadge(standing)}
								</td>
								<td>
									<span
										class="{standing.isWithdrawn
											? 'text-withdrawn'
											: 'font-medium text-blue-600 hover:underline'}"
									>
										{standing.teamName}
									</span>
									{#if standing.isWithdrawn}
										<span class="badge badge-danger ml-2">已退赛</span>
									{/if}
								</td>
								<td class="text-center">{standing.played}</td>
								<td class="text-center text-green-600 font-medium">{standing.won}</td>
								<td class="text-center text-gray-500 font-medium">{standing.drawn}</td>
								<td class="text-center text-red-600 font-medium">{standing.lost}</td>
								<td class="text-center">{standing.goalsFor}</td>
								<td class="text-center">{standing.goalsAgainst}</td>
								<td
									class="text-center font-medium {standing.goalDifference > 0
										? 'text-green-600'
										: standing.goalDifference < 0
											? 'text-red-600'
											: ''}"
								>
									{standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
								</td>
								<td class="text-center">
									{#if standing.forfeits > 0}
										<span class="badge badge-danger">{standing.forfeits}</span>
									{:else}
										0
									{/if}
								</td>
								<td class="text-center font-bold text-xl text-blue-600">
									{standing.points}
								</td>
								<td class="text-center font-bold {getRankChangeClass(standing)}">
									{getRankChange(standing)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="card">
			<h3 class="card-title">同分排序规则</h3>
			<ol class="list-decimal list-inside space-y-2 text-gray-600">
				<li>积分</li>
				<li>净胜球</li>
				<li>进球数</li>
				<li>相互对赛成绩（积分 → 净胜球）</li>
				<li>队名字母顺序</li>
			</ol>
			<p class="mt-4 text-sm text-muted">
				说明：弃权方按 0-3 计算比分，积 0 分；对方积 3 分，按 3-0 计算。已退赛队伍排名垫底。
			</p>
		</div>
	{/if}
</div>
