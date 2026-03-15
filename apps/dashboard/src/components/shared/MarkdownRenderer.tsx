import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-text-primary mt-6 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-text-primary mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-text-secondary leading-relaxed mb-3">{children}</p>,
          ul: ({ children }) => <ul className="text-sm text-text-secondary space-y-1 mb-3 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="text-sm text-text-secondary space-y-1 mb-3 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-text-secondary">{children}</li>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return <code className="px-1.5 py-0.5 bg-surface-3 rounded text-xs font-mono text-accent" {...props}>{children}</code>;
            }
            return (
              <pre className="bg-surface-0 border border-border rounded-lg p-4 overflow-x-auto mb-3">
                <code className="text-xs font-mono text-text-secondary" {...props}>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent pl-4 text-sm text-text-tertiary italic mb-3">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
