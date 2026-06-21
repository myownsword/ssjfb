<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentSeasonId,
		teams,
		seasons,
		showError,
		showSuccess
	} from '$lib/stores';
	import type { Team, Season } from '$lib/types';
	import { goto } from '$app/navigation';

	let newTeamName = $state('');
	let isCreating = $state(false);

	async function loadTeams() {
		if (!$currentSeasonId) return;

		try {
			const res = await fetch(`/api/teams?seasonId=${$currentSeasonId}`);
			if (res.ok) {
				const data = await res.json();
				teams.set(data);
			}
		} catch (e) {
			showError('加载队伍列表失败');
		}
	}

	async function createTeam(e: Event) {
		e.preventDefault();
		if (!$currentSeasonId) {
			showError('请先选择一个赛季');
			return;
		}

		if (!newTeamName.trim()) {
			showError('请输入队伍名称');
			return;
		}

		isCreating = true;
		try {
			const res = await fetch('/api/teams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seasonId: $currentSeasonId,
					name: newTeamName.trim()
				})
			});

			if (res.ok) {
				const newTeam = await res.json();
				showSuccess(`队伍 "${newTeam.name}" 创建成功`);
				newTeamName = '';
				await loadTeams();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('创建队伍失败');
		} finally {
			isCreating = false;
		}
	}

	async function withdrawTeam(team: Team) {
		if (!confirm(`确定要让队伍 "${team.name}" 退赛吗？退赛后将无法撤销。`)) return;

		try {
			const res = await fetch(`/api/teams/${team.id}/withdraw`, {
				method: 'POST'
			});

			if (res.ok) {
				showSuccess(`队伍 "${team.name}" 已退赛`);
				await loadTeams();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('操作失败');
		}
	}

	const currentSeason = $derived($seasons.find((s) => s.id === $currentSeasonId));

	const canEdit = $derived(!!(currentSeason && !currentSeason.isArchived));

	$effect(() => {
		if ($currentSeasonId) {
			loadTeams();
		}
	});

	onMount(() => {
		if ($currentSeasonId) {
			loadTeams();
		}
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString('zh-CN');
	}

	function goToTeamDetail(teamId: string) {
		goto(`/teams/${teamId}`);
	}
</script>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-2xl font-bold text-gray-800">队伍管理</h2>
			<p class="text-muted">
				当前赛季: <span class="font-medium">{currentSeason?.name || '未选择'}</span>
				{#if currentSeason?.isArchived}
					<span class="badge badge-gray ml-2">已归档</span>
				{/if}
			</p>
		</div>
	</div>

	{#if !$currentSeasonId}
		<div class="card text-center py-12">
			<p class="text-muted text-lg">请先选择一个赛季</p>
		</div>
	{:else}
		{#if canEdit}
			<div class="card">
				<h3 class="card-title">添加新队伍</h3>
				<form
					onsubmit={createTeam}
					class="flex gap-4 items-end"
				>
					<div class="form-group flex-1 mb-0">
						<label for="teamName">队伍名称</label>
						<input
							id="teamName"
							type="text"
							bind:value={newTeamName}
							placeholder="输入队伍名称"
							required
						/>
					</div>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={isCreating || !newTeamName.trim()}
					>
						{isCreating ? '添加中...' : '添加队伍'}
					</button>
				</form>
			</div>
		{/if}

		<div class="card">
			<h3 class="card-title">
				队伍列表
				<span class="text-sm font-normal text-muted ml-2">
					({$teams.length} 支队伍)
				</span>
			</h3>

			{#if $teams.length === 0}
				<p class="text-muted text-center py-8">暂无队伍</p>
			{:else}
				<div class="overflow-x-auto">
					<table>
						<thead>
							<tr>
								<th>队伍名称</th>
								<th>状态</th>
								<th>加入时间</th>
								<th>退赛时间</th>
								<th class="text-right">操作</th>
							</tr>
						</thead>
						<tbody>
							{#each $teams as team (team.id)}
								<tr
									class="{team.isWithdrawn
										? 'bg-gray-50'
										: ''} cursor-pointer hover:bg-blue-50 transition-colors"
									onclick={() => goToTeamDetail(team.id)}
								>
									<td class="font-medium">
										<span
											class="{team.isWithdrawn
												? 'text-withdrawn'
												: 'text-blue-600 hover:underline'}"
										>
											{team.name}
										</span>
									</td>
									<td>
										{#if team.isWithdrawn}
											<span class="badge badge-danger">已退赛</span>
										{:else}
											<span class="badge badge-success">正常</span>
										{/if}
									</td>
									<td>{formatDate(team.createdAt)}</td>
									<td>
										{team.withdrawnAt ? formatDate(team.withdrawnAt) : '—'}
									</td>
									<td class="text-right">
										{#if canEdit && !team.isWithdrawn}
											<button
												class="btn btn-danger"
												onclick={(e) => { e.stopPropagation(); withdrawTeam(team); }}
											>
												退赛
											</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="card bg-yellow-50">
			<h3 class="card-title text-yellow-800">退赛说明</h3>
			<ul class="list-disc list-inside space-y-1 text-yellow-700 text-sm">
				<li>队伍退赛后将无法撤销</li>
				<li>退赛队伍的已有比赛结果仍然有效</li>
				<li>退赛队伍在积分榜上排名垫底</li>
				<li>已退赛的队伍不能再参加比赛</li>
			</ul>
		</div>
	{/if}
</div>
