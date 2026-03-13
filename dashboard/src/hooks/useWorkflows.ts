import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import type { Workflow } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useWorkflows() {
  const { data, error, isLoading } = useSWR<{ workflows: Workflow[] }>(
    '/api/workflows',
    fetcher,
    { refreshInterval: POLL_INTERVAL * 4 }
  );
  return {
    workflows: data?.workflows || [],
    error,
    isLoading,
  };
}
