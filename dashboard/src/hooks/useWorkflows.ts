import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import { usePollingInterval } from './usePageVisibility';
import type { Workflow } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useWorkflows() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL * 4);
  const { data, error, isLoading } = useSWR<{ workflows: Workflow[] }>(
    '/api/workflows',
    fetcher,
    { refreshInterval }
  );
  return {
    workflows: data?.workflows || [],
    error,
    isLoading,
  };
}
