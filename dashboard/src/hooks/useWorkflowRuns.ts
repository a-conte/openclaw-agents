import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import type { WorkflowRun } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useWorkflowRuns() {
  const { data, error, isLoading } = useSWR<{ runs: WorkflowRun[] }>(
    '/api/workflows/runs',
    fetcher,
    { refreshInterval: POLL_INTERVAL }
  );
  return {
    runs: data?.runs || [],
    error,
    isLoading,
  };
}

export function useWorkflowRun(runId: string | null) {
  const isTerminal = (run?: WorkflowRun) =>
    run?.status === 'completed' || run?.status === 'failed';

  const { data, error, isLoading } = useSWR<{ run: WorkflowRun }>(
    runId ? `/api/workflows/runs/${runId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) => {
        if (isTerminal(latestData?.run)) return 0;
        return 3000;
      },
    }
  );
  return {
    run: data?.run || null,
    error,
    isLoading,
  };
}
