import { describe, it, expect } from 'vitest';
import { extractTextContent, getAgentStatus, truncate } from './utils';

describe('extractTextContent', () => {
  it('returns string content as-is', () => {
    expect(extractTextContent('hello world')).toBe('hello world');
  });

  it('extracts text from content blocks', () => {
    const blocks = [
      { type: 'text', text: 'line one' },
      { type: 'image' },
      { type: 'text', text: 'line two' },
    ];
    expect(extractTextContent(blocks)).toBe('line one\nline two');
  });

  it('handles empty array', () => {
    expect(extractTextContent([])).toBe('');
  });
});

describe('getAgentStatus', () => {
  it('returns offline when no activity', () => {
    expect(getAgentStatus()).toBe('offline');
    expect(getAgentStatus(undefined)).toBe('offline');
  });

  it('returns online for recent activity', () => {
    expect(getAgentStatus(Date.now() - 60_000)).toBe('online');
  });

  it('returns warning for stale activity', () => {
    expect(getAgentStatus(Date.now() - 30 * 60_000)).toBe('warning');
  });

  it('returns offline for very old activity', () => {
    expect(getAgentStatus(Date.now() - 2 * 60 * 60_000)).toBe('offline');
  });
});

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });

  it('handles exact length', () => {
    expect(truncate('abc', 3)).toBe('abc');
  });
});
