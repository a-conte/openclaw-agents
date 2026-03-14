'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

function getSnapshot() {
  return document.visibilityState === 'visible';
}

function getServerSnapshot() {
  return true;
}

export function usePageVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Returns the polling interval when the page is visible, or 0 (disabled) when hidden.
 */
export function usePollingInterval(baseInterval: number): number {
  const visible = usePageVisibility();
  return visible ? baseInterval : 0;
}
