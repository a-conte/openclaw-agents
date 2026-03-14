'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SWRConfig } from 'swr';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface DashboardFiltersState {
  search: string;
  agentId: string;
  focus: string;
}

interface DashboardContextValue {
  filters: DashboardFiltersState;
  setSearch: (value: string) => void;
  setAgentId: (value: string) => void;
  setFocus: (value: string) => void;
  resetFilters: () => void;
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  setStatusBanner: (key: string, banner: Omit<StatusBannerItem, 'key'>) => void;
  clearStatusBanner: (key: string) => void;
  isChatOpen: boolean;
  chatAgentId: string;
  openChat: (agentId?: string) => void;
  closeChat: () => void;
}

interface StatusBannerItem {
  key: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const STORAGE_KEY = 'openclaw-dashboard-filters';

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DashboardFiltersState>({ search: '', agentId: '', focus: '' });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [statusBanners, setStatusBanners] = useState<StatusBannerItem[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAgentId, setChatAgentId] = useState('main');

  const openChat = useCallback((agentId?: string) => {
    if (agentId) setChatAgentId(agentId);
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setFilters({
        search: typeof parsed.search === 'string' ? parsed.search : '',
        agentId: typeof parsed.agentId === 'string' ? parsed.agentId : '',
        focus: typeof parsed.focus === 'string' ? parsed.focus : '',
      });
    } catch {
      // ignore persisted state errors
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const setSearch = useCallback((value: string) => {
    setFilters((current) => ({ ...current, search: value }));
  }, []);

  const setAgentId = useCallback((value: string) => {
    setFilters((current) => ({ ...current, agentId: value }));
  }, []);

  const setFocus = useCallback((value: string) => {
    setFilters((current) => ({ ...current, focus: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ search: '', agentId: '', focus: '' });
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const setStatusBanner = useCallback((key: string, banner: Omit<StatusBannerItem, 'key'>) => {
    setStatusBanners((current) => {
      const next = current.filter((item) => item.key !== key);
      return [...next, { ...banner, key }];
    });
  }, []);

  const clearStatusBanner = useCallback((key: string) => {
    setStatusBanners((current) => current.filter((item) => item.key !== key));
  }, []);

  const value = useMemo(
    () => ({ filters, setSearch, setAgentId, setFocus, resetFilters, pushToast, setStatusBanner, clearStatusBanner, isChatOpen, chatAgentId, openChat, closeChat }),
    [clearStatusBanner, filters, pushToast, resetFilters, setAgentId, setFocus, setSearch, setStatusBanner, isChatOpen, chatAgentId, openChat, closeChat]
  );

  return (
    <SWRConfig value={{ revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 1500, focusThrottleInterval: 15000 }}>
      <DashboardContext.Provider value={value}>
        {children}
        <div className="pointer-events-none fixed right-4 top-16 z-[55] flex w-full max-w-md flex-col gap-2 px-4">
          {statusBanners.map((banner) => (
            <StatusBannerCard key={banner.key} banner={banner} onDismiss={() => clearStatusBanner(banner.key)} />
          ))}
        </div>
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
          ))}
        </div>
      </DashboardContext.Provider>
    </SWRConfig>
  );
}

function StatusBannerCard({ banner, onDismiss }: { banner: StatusBannerItem; onDismiss: () => void }) {
  const toneClass = {
    success: 'border-green-500/25 bg-green-500/12 text-green-100',
    error: 'border-red-500/25 bg-red-500/12 text-red-100',
    info: 'border-accent-blue/25 bg-accent-blue/12 text-blue-100',
  }[banner.tone];

  return (
    <div className={cn('pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur', toneClass)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{banner.title}</div>
          {banner.description && <div className="mt-1 text-xs leading-relaxed opacity-90">{banner.description}</div>}
        </div>
        <button onClick={onDismiss} className="shrink-0 text-current/60 transition hover:text-current">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const toneClass = {
    success: 'border-green-500/25 bg-green-500/12 text-green-100',
    error: 'border-red-500/25 bg-red-500/12 text-red-100',
    info: 'border-border bg-surface-2/95 text-text-primary',
  }[toast.tone];

  const icon = {
    success: <CheckCircle2 size={16} className="text-green-300" />,
    error: <AlertTriangle size={16} className="text-red-300" />,
    info: <Info size={16} className="text-accent-blue" />,
  }[toast.tone];

  return (
    <div className={cn('pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur', toneClass)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description && <div className="mt-1 text-xs leading-relaxed opacity-90">{toast.description}</div>}
        </div>
        <button onClick={onDismiss} className="shrink-0 text-current/60 transition hover:text-current">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function useDashboardFilters() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboardFilters must be used within DashboardProviders');
  return {
    filters: context.filters,
    setSearch: context.setSearch,
    setAgentId: context.setAgentId,
    setFocus: context.setFocus,
    resetFilters: context.resetFilters,
  };
}

export function useToast() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useToast must be used within DashboardProviders');
  return {
    pushToast: context.pushToast,
  };
}

export function useChatPanel() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useChatPanel must be used within DashboardProviders');
  return {
    isChatOpen: context.isChatOpen,
    chatAgentId: context.chatAgentId,
    openChat: context.openChat,
    closeChat: context.closeChat,
  };
}

export function useStatusBanners() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useStatusBanners must be used within DashboardProviders');
  return {
    setStatusBanner: context.setStatusBanner,
    clearStatusBanner: context.clearStatusBanner,
  };
}
