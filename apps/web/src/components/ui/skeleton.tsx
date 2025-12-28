import { cn } from '@/lib/utils';

function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg skeleton-shimmer',
        'bg-gradient-to-br from-tm-card-soft via-tm-card/60 to-tm-card-soft',
        'border border-tm-border/40',
        className
      )}
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(11, 17, 32, 0.85) 50%, rgba(15, 23, 42, 0.95) 100%)',
        ...style,
      }}
      {...props}
    />
  );
}

export { Skeleton };

