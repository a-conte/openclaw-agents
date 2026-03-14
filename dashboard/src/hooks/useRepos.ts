import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import { usePollingInterval } from './usePageVisibility';
import type { RepoStatus } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useRepos() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL * 2);
  const { data, error, isLoading } = useSWR<{ repos: RepoStatus[] }>(
    '/api/repos',
    fetcher,
    { refreshInterval }
  );
  return {
    repos: data?.repos || [],
    error,
    isLoading,
  };
}
