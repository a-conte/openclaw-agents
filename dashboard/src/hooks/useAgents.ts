import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';
import { usePollingInterval } from './usePageVisibility';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAgents() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error, isLoading } = useSWR('/api/agents', fetcher, {
    refreshInterval,
  });
  return { agents: data || [], error, isLoading };
}

export function useAgent(agentId: string) {
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error, isLoading, mutate } = useSWR(
    agentId ? `/api/agents/${agentId}` : null,
    fetcher,
    { refreshInterval }
  );
  return { agent: data, error, isLoading, mutate };
}

export function useHealth() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error, isLoading } = useSWR('/api/health', fetcher, {
    refreshInterval,
  });
  return { health: data, error, isLoading };
}

export function useActivity() {
  const refreshInterval = usePollingInterval(POLL_INTERVAL * 2);
  const { data, error, isLoading } = useSWR('/api/activity', fetcher, {
    refreshInterval,
  });
  return { events: data || [], error, isLoading };
}
