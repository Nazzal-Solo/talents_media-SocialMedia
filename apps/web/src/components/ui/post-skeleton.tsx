export function PostSkeleton() {
  return (
    <div className="rounded-xl border border-tm-border/60 bg-tm-card/90 p-6 backdrop-blur-xl shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar skeleton */}
          <div className="h-10 w-10 animate-pulse rounded-full bg-tm-border/60" />
          <div className="space-y-2">
            {/* Name skeleton */}
            <div className="h-4 w-24 animate-pulse rounded bg-tm-border/60" />
            {/* Meta skeleton */}
            <div className="h-3 w-32 animate-pulse rounded bg-tm-border/40" />
          </div>
        </div>
        {/* Menu button skeleton */}
        <div className="h-8 w-8 animate-pulse rounded-full bg-tm-border/60" />
      </div>

      {/* Content skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-tm-border/60" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-tm-border/60" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-tm-border/60" />
      </div>

      {/* Media skeleton */}
      <div className="mb-4 aspect-video w-full animate-pulse rounded-lg bg-tm-border/60" />

      {/* Actions skeleton */}
      <div className="flex items-center justify-between border-t border-tm-border/40 pt-4">
        <div className="flex items-center space-x-6">
          <div className="h-5 w-16 animate-pulse rounded bg-tm-border/60" />
          <div className="h-5 w-20 animate-pulse rounded bg-tm-border/60" />
          <div className="h-5 w-16 animate-pulse rounded bg-tm-border/60" />
        </div>
      </div>
    </div>
  );
}

