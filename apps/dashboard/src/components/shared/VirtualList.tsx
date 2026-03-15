'use client';

import type { RefObject } from 'react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({ items, itemHeight, height, overscan = 5, className, containerRef, renderItem }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const { start, end, visibleItems } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, Math.ceil((scrollTop + height) / itemHeight) + overscan);
    return {
      start: startIndex,
      end: endIndex,
      visibleItems: items.slice(startIndex, endIndex),
    };
  }, [height, itemHeight, items, overscan, scrollTop]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={cn('overflow-auto', className)}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * itemHeight}px)` }}>
          {visibleItems.map((item, index) => renderItem(item, start + index))}
        </div>
      </div>
    </div>
  );
}
