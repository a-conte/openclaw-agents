import useSWR from 'swr';
import { usePollingInterval } from './usePageVisibility';
import { POLL_INTERVAL } from '@/lib/constants';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardSummary() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error, isLoading } = useSWR('/api/dashboard-summary', fetcher, {
    refreshInterval,
  });

  return {
    health: data?.health,
    counts: data?.counts,
    radarCount: data?.counts?.radarCount ?? 0,
    error,
    isLoading,
  };
}
