import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import type { RepoStatus } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useRepos() {
  const { data, error, isLoading } = useSWR<{ repos: RepoStatus[] }>(
    '/api/repos',
    fetcher,
    { refreshInterval: POLL_INTERVAL * 2 }
  );
  return {
    repos: data?.repos || [],
    error,
    isLoading,
  };
}
