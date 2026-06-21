<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { errorMessage, currentSeasonId, seasons } from '$lib/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();

	const currentPath = $derived($page.url.pathname);

	async function loadSeasons() {
		try {
			const res = await fetch('/api/seasons');
			if (res.ok) {
				const data = await res.json();
				seasons.set(data);
				if (data.length > 0 && !$currentSeasonId) {
					const activeSeason = data.find((s: any) => !s.isArchived) || data[0];
					currentSeasonId.set(activeSeason.id);
				}
			}
		} catch (e) {
			console.error('Failed to load seasons', e);
		}
	}

	onMount(() => {
		loadSeasons();
	});

	function changeSeason(e: Event) {
		const target = e.target as HTMLSelectElement;
		currentSeasonId.set(target.value);
	}

	function isActive(path: string): boolean {
		if (path === '/' && currentPath === '/') return true;
		if (path !== '/' && currentPath.startsWith(path)) return true;
		return false;
	}
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-blue-600 text-white shadow-lg">
		<div class="max-w-7xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between flex-wrap gap-4">
				<h1 class="text-2xl font-bold">赛事积分榜系统</h1>

				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2">
						<span class="text-sm">当前赛季:</span>
						<select
							bind:value={$currentSeasonId}
							onchange={changeSeason}
							class="px-3 py-2 rounded text-gray-800 bg-white min-w-[200px]"
							disabled={$seasons.length === 0}
						>
							{#each $seasons as season}
								<option value={season.id}>
									{season.name} {season.isArchived ? '(已归档)' : ''}
								</option>
							{:else}
								<option value="">暂无赛季</option>
							{/each}
						</select>
					</label>

					<nav class="flex gap-1">
						<a
							href="/"
							class="px-4 py-2 rounded transition-colors {isActive('/')
								? 'bg-blue-700'
								: 'hover:bg-blue-500'}"
						>
							积分榜
						</a>
						<a
							href="/fixtures"
							class="px-4 py-2 rounded transition-colors {isActive('/fixtures')
								? 'bg-blue-700'
								: 'hover:bg-blue-500'}"
						>
							赛程与结果
						</a>
						<a
							href="/teams"
							class="px-4 py-2 rounded transition-colors {isActive('/teams')
								? 'bg-blue-700'
								: 'hover:bg-blue-500'}"
						>
							队伍管理
						</a>
						<a
							href="/seasons"
							class="px-4 py-2 rounded transition-colors {isActive('/seasons')
								? 'bg-blue-700'
								: 'hover:bg-blue-500'}"
						>
							赛季管理
						</a>
					</nav>
				</div>
			</div>
		</div>
	</header>

	{#if $errorMessage}
		<div
			class="max-w-7xl mx-auto px-4 py-2 mt-4"
		>
			<div
				class="px-4 py-3 rounded-lg {$errorMessage.startsWith('SUCCESS:')
					? 'bg-green-100 text-green-800'
					: 'bg-red-100 text-red-800'}"
			>
				{$errorMessage.replace('SUCCESS: ', '')}
			</div>
		</div>
	{/if}

	<main class="max-w-7xl mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>
