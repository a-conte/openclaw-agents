import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'default' | 'outline';
  className?: string;
}

export function Badge({ children, color, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variant === 'outline'
          ? 'border border-border text-text-secondary'
          : 'text-white',
        className
      )}
      style={variant === 'default' && color ? { backgroundColor: color + '33', color } : undefined}
    >
      {children}
    </span>
  );
}
