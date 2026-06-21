<script lang="ts">
	import { onMount } from 'svelte';
	import { seasons, currentSeasonId, showError, showSuccess } from '$lib/stores';
	import type { Season } from '$lib/types';

	let newSeasonName = $state('');
	let isCreating = $state(false);

	async function loadSeasons() {
		try {
			const res = await fetch('/api/seasons');
			if (res.ok) {
				const data = await res.json();
				seasons.set(data);
			}
		} catch (e) {
			showError('加载赛季列表失败');
		}
	}

	async function createSeason(e: Event) {
		e.preventDefault();
		if (!newSeasonName.trim()) {
			showError('请输入赛季名称');
			return;
		}

		isCreating = true;
		try {
			const res = await fetch('/api/seasons', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newSeasonName.trim() })
			});

			if (res.ok) {
				const newSeason = await res.json();
				showSuccess(`赛季 "${newSeason.name}" 创建成功`);
				newSeasonName = '';
				await loadSeasons();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('创建赛季失败');
		} finally {
			isCreating = false;
		}
	}

	async function toggleArchive(season: Season) {
		const action = season.isArchived ? '取消归档' : '归档';
		if (!confirm(`确定要${action}赛季 "${season.name}" 吗？${!season.isArchived ? '归档后将无法再编辑数据。' : ''}`)) return;

		try {
			const res = await fetch(`/api/seasons/${season.id}/archive`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ archive: !season.isArchived, unarchive: season.isArchived })
			});

			if (res.ok) {
				showSuccess(`赛季已${action}`);
				await loadSeasons();
			} else {
				const err = await res.text();
				showError(err);
			}
		} catch (e) {
			showError('操作失败');
		}
	}

	function selectSeason(season: Season) {
		currentSeasonId.set(season.id);
	}

	onMount(() => {
		loadSeasons();
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString('zh-CN');
	}
</script>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-800">赛季管理</h2>
	</div>

	<div class="card">
		<h3 class="card-title">创建新赛季</h3>
		<form
			onsubmit={createSeason}
			class="flex gap-4 items-end"
		>
			<div class="form-group flex-1 mb-0">
				<label for="seasonName">赛季名称</label>
				<input
					id="seasonName"
					type="text"
					bind:value={newSeasonName}
					placeholder="例如：2024-2025赛季"
					required
				/>
			</div>
			<button
				type="submit"
				class="btn btn-primary"
				disabled={isCreating || !newSeasonName.trim()}
			>
				{isCreating ? '创建中...' : '创建赛季'}
			</button>
		</form>
	</div>

	<div class="card">
		<h3 class="card-title">赛季列表</h3>
		{#if $seasons.length === 0}
			<p class="text-muted text-center py-8">暂无赛季，请先创建一个赛季</p>
		{:else}
			<div class="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>赛季名称</th>
							<th>状态</th>
							<th>创建时间</th>
							<th>归档时间</th>
							<th class="text-right">操作</th>
						</tr>
					</thead>
					<tbody>
						{#each $seasons as season (season.id)}
							<tr
								class="{season.id === $currentSeasonId
									? 'bg-blue-50'
									: ''} cursor-pointer hover:bg-gray-50 transition-colors"
								onclick={() => selectSeason(season)}
							>
								<td class="font-medium">
									{season.name}
									{#if season.id === $currentSeasonId}
										<span class="badge badge-info ml-2">当前</span>
									{/if}
								</td>
								<td>
									{#if season.isArchived}
										<span class="badge badge-gray">已归档</span>
									{:else}
										<span class="badge badge-success">进行中</span>
									{/if}
								</td>
								<td>{formatDate(season.createdAt)}</td>
								<td>
									{season.archivedAt ? formatDate(season.archivedAt) : '—'}
								</td>
								<td class="text-right">
									<button
										class="btn {season.isArchived ? 'btn-secondary' : 'btn-warning'}"
										onclick={(e) => { e.stopPropagation(); toggleArchive(season); }}
									>
										{season.isArchived ? '取消归档' : '归档'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<div class="card bg-yellow-50">
		<h3 class="card-title text-yellow-800">归档说明</h3>
		<ul class="list-disc list-inside space-y-1 text-yellow-700 text-sm">
			<li>归档后的赛季无法再添加、编辑或撤回比赛结果</li>
			<li>归档后的赛季无法再添加或退赛队伍</li>
			<li>归档后的赛季无法再添加赛程</li>
			<li>已归档的赛季可以取消归档，恢复编辑权限</li>
			<li>建议赛季结束后进行归档，以防止误操作</li>
		</ul>
	</div>
</div>
