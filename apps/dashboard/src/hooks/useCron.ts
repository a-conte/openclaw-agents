import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import { usePollingInterval } from './usePageVisibility';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useCron() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error, isLoading } = useSWR('/api/cron', fetcher, {
    refreshInterval,
  });
  return {
    cronJobs: data?.cronJobs || [],
    heartbeats: data?.heartbeats || [],
    error,
    isLoading,
  };
}
