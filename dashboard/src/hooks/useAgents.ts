import useSWR from 'swr';
import { POLL_INTERVAL } from '@/lib/constants';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAgents() {
  const { data, error, isLoading } = useSWR('/api/agents', fetcher, {
    refreshInterval: POLL_INTERVAL,
  });
  return { agents: data || [], error, isLoading };
}

export function useAgent(agentId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    agentId ? `/api/agents/${agentId}` : null,
    fetcher,
    { refreshInterval: POLL_INTERVAL }
  );
  return { agent: data, error, isLoading, mutate };
}

export function useHealth() {
  const { data, error, isLoading } = useSWR('/api/health', fetcher, {
    refreshInterval: POLL_INTERVAL,
  });
  return { health: data, error, isLoading };
}

export function useActivity() {
  const { data, error, isLoading } = useSWR('/api/activity', fetcher, {
    refreshInterval: POLL_INTERVAL,
  });
  return { events: data || [], error, isLoading };
}
