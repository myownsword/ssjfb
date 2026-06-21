import { writable } from 'svelte/store';
import type { Season, TeamStanding, Team, Fixture, MatchResult } from '$lib/types';

export const currentSeasonId = writable<string | null>(null);
export const seasons = writable<Season[]>([]);
export const standings = writable<TeamStanding[]>([]);
export const teams = writable<Team[]>([]);
export const fixtures = writable<Fixture[]>([]);
export const matchResults = writable<MatchResult[]>([]);
export const isLoading = writable(false);
export const errorMessage = writable<string | null>(null);

export function showError(message: string) {
	errorMessage.set(message);
	setTimeout(() => errorMessage.set(null), 5000);
}

export function showSuccess(message: string) {
	errorMessage.set(`SUCCESS: ${message}`);
	setTimeout(() => errorMessage.set(null), 3000);
}
