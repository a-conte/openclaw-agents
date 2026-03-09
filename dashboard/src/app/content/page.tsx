'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { FileText, Search } from 'lucide-react';
import { AGENT_EMOJIS, AGENT_COLORS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import Fuse from 'fuse.js';
import type { Document } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const CATEGORY_COLORS: Record<string, string> = {
  Identity: '#8338ec',
  Technical: '#4A9EFF',
  Memory: '#06d6a0',
  Operations: '#ffd166',
  Documentation: '#FB5656',
  Research: '#e94560',
  Security: '#ff6b35',
  Strategy: '#4A9EFF',
  General: '#555555',
};

export default function ContentPage() {
  const { data, isLoading } = useSWR('/api/content', fetcher, { refreshInterval: 60000 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const documents: Document[] = data?.documents || [];

  const categories = useMemo(() => {
    const cats = new Set(documents.map(d => d.category));
    return ['', ...Array.from(cats).sort()];
  }, [documents]);

  const filtered = useMemo(() => {
    let docs = documents;
    if (categoryFilter) {
      docs = docs.filter(d => d.category === categoryFilter);
    }
    if (search.trim()) {
      const fuse = new Fuse(docs, { keys: ['title', 'category', 'agentId'], threshold: 0.4 });
      docs = fuse.search(search).map(r => r.item);
    }
    return docs;
  }, [documents, search, categoryFilter]);

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Content</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {documents.length} document{documents.length !== 1 ? 's' : ''} across all agents
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat || 'all'}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-full transition-colors',
                categoryFilter === cat
                  ? 'bg-accent/15 text-accent'
                  : 'bg-surface-3 text-text-tertiary hover:text-text-secondary'
              )}
            >
              {cat || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText size={32} />} title="No documents found" description="No matching documents in agent directories" />
      ) : (
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={14} className="text-text-tertiary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">{doc.title}</div>
                  <div className="text-xs text-text-tertiary truncate">{doc.path}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <Badge color={CATEGORY_COLORS[doc.category] || '#555'}>{doc.category}</Badge>
                <span className="text-xs text-text-tertiary">{AGENT_EMOJIS[doc.agentId] || '📁'} {doc.agentId}</span>
                <span className="text-xs text-text-tertiary tabular-nums">{formatDate(doc.date, 'MMM d')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
