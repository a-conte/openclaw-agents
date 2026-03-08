import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useCron() {
  const { data, error, isLoading } = useSWR('/api/cron', fetcher, {
    refreshInterval: POLL_INTERVAL,
  });
  return {
    cronJobs: data?.cronJobs || [],
    heartbeats: data?.heartbeats || [],
    error,
    isLoading,
  };
}
