import { useSyncExternalStore } from 'react';

const MAX_RECENT_SEARCHES = 6;
let recentSearchesState: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function addRecentSearch(term: string): void {
  const clean = term.trim().slice(0, 120);
  if (!clean) return;
  recentSearchesState = [
    clean,
    ...recentSearchesState.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);
  notify();
}

export function removeRecentSearch(term: string): void {
  recentSearchesState = recentSearchesState.filter((item) => item !== term);
  notify();
}

export function clearRecentSearches(): void {
  recentSearchesState = [];
  notify();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): string[] {
  return recentSearchesState;
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    searches,
    addSearch: addRecentSearch,
    removeSearch: removeRecentSearch,
    clearSearches: clearRecentSearches,
  };
}
