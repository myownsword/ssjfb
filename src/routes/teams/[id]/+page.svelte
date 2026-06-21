<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { currentSeasonId, showError, teams, standings } from '$lib/stores';
	import type { Team, MatchImpact, TeamStanding } from '$lib/types';
	import { goto } from '$app/navigation';

	let team = $state<Team | null>(null);
	let impacts = $state<MatchImpact[]>([]);
	let teamStanding = $state<TeamStanding | null>(null);
	let isLoading = $state(true);

	async function loadData() {
		const teamId = $page.params.id;
		if (!teamId || !$currentSeasonId) {
			isLoading = false;
			return;
		}

		isLoading = true;
		try {
			const teamsRes = await fetch(`/api/teams?seasonId=${$currentSeasonId}`);
			if (teamsRes.ok) {
				const teamsData = await teamsRes.json();
				teams.set(teamsData);
				team = teamsData.find((t: Team) => t.id === teamId) || null;
			}

			const impactsRes = await fetch(
				`/api/teams/${teamId}/impacts?seasonId=${$currentSeasonId}`
			);
			if (impactsRes.ok) {
				impacts = await impactsRes.json();
			}

			const standingsRes = await fetch(`/api/standings?seasonId=${$currentSeasonId}`);
			if (standingsRes.ok) {
				const standingsData = await standingsRes.json();
				standings.set(standingsData);
				teamStanding = standingsData.find((s: TeamStanding) => s.teamId === teamId) || null;
			}
		} catch (e) {
			showError('加载数据失败');
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if ($currentSeasonId && $page.params.id) {
			loadData();
		}
	});

	onMount(() => {
		if ($currentSeasonId && $page.params.id) {
			loadData();
		}
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('zh-CN');
	}

	function getResultText(impact: MatchImpact): string {
		const myScore = impact.isHome ? impact.homeScore : impact.awayScore;
		const oppScore = impact.isHome ? impact.awayScore : impact.homeScore;

		if (myScore > oppScore) {
			return '胜';
		} else if (myScore < oppScore) {
			return '负';
		} else {
			return '平';
		}
	}

	function getResultClass(impact: MatchImpact): string {
		const myScore = impact.isHome ? impact.homeScore : impact.awayScore;
		const oppScore = impact.isHome ? impact.awayScore : impact.homeScore;

		if (myScore > oppScore) {
			return 'text-green-600';
		} else if (myScore < oppScore) {
			return 'text-red-600';
		} else {
			return 'text-gray-600';
		}
	}

	function getResultBadge(impact: MatchImpact): string {
		const result = getResultText(impact);
		if (result === '胜') return 'badge-success';
		if (result === '负') return 'badge-danger';
		return 'badge-gray';
	}

	function goBack() {
		goto('/teams');
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<button class="btn btn-secondary" onclick={goBack}>← 返回队伍列表</button>
	</div>

	{#if isLoading}
		<div class="card text-center py-12">
			<p class="text-muted">加载中...</p>
		</div>
	{:else if !team}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">队伍不存在</p>
		</div>
	{:else}
		<div class="card">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-3xl font-bold text-gray-800">
						{team.name}
						{#if team.isWithdrawn}
							<span class="badge badge-danger ml-3">已退赛</span>
						{/if}
					</h2>
					<p class="text-muted mt-2">
						加入时间: {formatDate(team.createdAt)}
						{#if team.withdrawnAt}
							<span class="ml-4">退赛时间: {formatDate(team.withdrawnAt)}</span>
						{/if}
					</p>
				</div>

				{#if teamStanding}
					<div class="text-right">
						<div class="text-5xl font-bold text-blue-600">#{teamStanding.rank}</div>
						<div class="text-2xl font-semibold text-gray-700 mt-1">
							{teamStanding.points} <span class="text-lg font-normal">分</span>
						</div>
						<div class="text-sm text-muted mt-1">
							{teamStanding.played}场 {teamStanding.won}胜 {teamStanding.drawn}平 {teamStanding.lost}负
						</div>
						<div class="text-sm text-muted">
							净胜球: {teamStanding.goalDifference > 0 ? '+' : ''}{teamStanding.goalDifference}
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if teamStanding}
			<div class="card">
				<h3 class="card-title">赛季数据</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
					<div class="text-center p-4 bg-blue-50 rounded-lg">
						<div class="text-3xl font-bold text-blue-600">{teamStanding.played}</div>
						<div class="text-sm text-muted">场次</div>
					</div>
					<div class="text-center p-4 bg-green-50 rounded-lg">
						<div class="text-3xl font-bold text-green-600">{teamStanding.won}</div>
						<div class="text-sm text-muted">胜</div>
					</div>
					<div class="text-center p-4 bg-gray-50 rounded-lg">
						<div class="text-3xl font-bold text-gray-600">{teamStanding.drawn}</div>
						<div class="text-sm text-muted">平</div>
					</div>
					<div class="text-center p-4 bg-red-50 rounded-lg">
						<div class="text-3xl font-bold text-red-600">{teamStanding.lost}</div>
						<div class="text-sm text-muted">负</div>
					</div>
					<div class="text-center p-4 bg-indigo-50 rounded-lg">
						<div class="text-3xl font-bold text-indigo-600">{teamStanding.goalsFor}</div>
						<div class="text-sm text-muted">进球</div>
					</div>
					<div class="text-center p-4 bg-orange-50 rounded-lg">
						<div class="text-3xl font-bold text-orange-600">{teamStanding.goalsAgainst}</div>
						<div class="text-sm text-muted">失球</div>
					</div>
					<div class="text-center p-4 bg-purple-50 rounded-lg">
						<div class="text-3xl font-bold text-purple-600">{teamStanding.goalDifference > 0 ? '+' : ''}{teamStanding.goalDifference}</div>
						<div class="text-sm text-muted">净胜球</div>
					</div>
					<div class="text-center p-4 bg-yellow-50 rounded-lg">
						<div class="text-3xl font-bold text-yellow-600">{teamStanding.points}</div>
						<div class="text-sm text-muted">积分</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="card">
			<h3 class="card-title">比赛记录与积分影响</h3>
			{#if impacts.length === 0}
				<p class="text-muted text-center py-8">暂无比赛记录</p>
			{:else}
				<div class="overflow-x-auto">
					<table>
						<thead>
							<tr>
								<th>轮次</th>
								<th>对手</th>
								<th>主客</th>
								<th>比分</th>
								<th>结果</th>
								<th>积分变化</th>
								<th>累计积分</th>
								<th>当时排名</th>
								<th>日期</th>
							</tr>
						</thead>
						<tbody>
							{#each impacts as impact, index (impact.matchResultId)}
								<tr>
									<td class="font-medium">{index + 1}</td>
									<td class="font-medium">{impact.opponentName}</td>
									<td>
										<span class="badge {impact.isHome ? 'badge-info' : 'badge-gray'}">
											{impact.isHome ? '主场' : '客场'}
										</span>
									</td>
									<td class="font-bold text-lg">
										{impact.isHome
											? `${impact.homeScore} - ${impact.awayScore}`
											: `${impact.awayScore} - ${impact.homeScore}`}
									</td>
									<td>
										<span class="badge {getResultBadge(impact)}">
											{getResultText(impact)}
										</span>
									</td>
									<td class="font-bold {impact.pointsChange > 0
										? 'text-green-600'
										: impact.pointsChange < 0
											? 'text-red-600'
											: 'text-gray-600'}">
										{impact.pointsChange > 0 ? '+' : ''}{impact.pointsChange}
									</td>
									<td class="font-bold text-blue-600">{impact.pointsAfter}</td>
									<td class="font-bold">#{impact.rankAfter}</td>
									<td class="text-muted">{formatDate(impact.matchDate)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="card">
			<h3 class="card-title">积分走势图</h3>
			{#if impacts.length === 0}
				<p class="text-muted text-center py-8">暂无比赛记录</p>
			{:else}
				<div class="h-64 flex items-end gap-2 px-4">
					{#each impacts as impact, index (impact.matchResultId)}
						<div class="flex-1 flex flex-col items-center">
							<div
								class="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
								style="height: {Math.max((impact.pointsAfter / Math.max(...impacts.map(i => i.pointsAfter), 1)) * 180, 10)}px;"
								title={`第${index + 1}场: ${impact.pointsAfter}分`}
							></div>
							<div class="text-xs text-muted mt-2">{index + 1}</div>
						</div>
					{/each}
				</div>
				<div class="text-center text-sm text-muted mt-4">
					横轴：场次 &nbsp;&nbsp; 纵轴：累计积分
				</div>
			{/if}
		</div>
	{/if}
</div>
