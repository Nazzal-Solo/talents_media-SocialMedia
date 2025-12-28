import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PostComposer } from '@/components/post-composer';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/ui/post-skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useFeedStore } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Post } from '@/store/feed-store';

export function Feed() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);
  const addPost = useFeedStore(state => state.addPost);
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite query for feed pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', isAuthenticated],
    queryFn: async ({ pageParam = 1 }) => {
      const url = `/api/posts/feed?page=${pageParam}&limit=20`;
      const response = await apiClient.get<{
        posts: Post[];
        page: number;
        limit: number;
      }>(url);
      return {
        posts: response.posts || [],
        page: response.page || pageParam,
        nextPage: (response.posts || []).length >= 20 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  // Flatten all pages into a single posts array
  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  // Intersection Observer for auto-loading
  useEffect(() => {
    if (!isAuthenticated || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          fetchNextPage();
        }
      },
      {
        rootMargin: '200px', // Trigger 200px before reaching the element
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isAuthenticated, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handlePostCreated = (newPost: Post) => {
    // Add to Zustand store (for other components that might use it)
    addPost(newPost);
    
    // Optimistically update React Query cache
    queryClient.setQueryData<{
      pages: Array<{
        posts: Post[];
        page: number;
        nextPage?: number;
      }>;
      pageParams: number[];
    }>(['feed', isAuthenticated], (oldData) => {
      if (!oldData) {
        // If no data exists, create initial structure
        return {
          pages: [
            {
              posts: [newPost],
              page: 1,
              nextPage: undefined,
            },
          ],
          pageParams: [1],
        };
      }

      // Check if post already exists in cache (prevent duplicates)
      const allExistingPosts = oldData.pages.flatMap(page => page.posts);
      const postExists = allExistingPosts.some(post => post.id === newPost.id);
      
      if (postExists) {
        // Post already exists, don't add duplicate
        return oldData;
      }

      // Prepend new post to the first page (remove any duplicate first)
      const firstPage = oldData.pages[0];
      const filteredFirstPagePosts = firstPage.posts.filter(post => post.id !== newPost.id);
      const updatedFirstPage = {
        ...firstPage,
        posts: [newPost, ...filteredFirstPagePosts],
      };

      return {
        ...oldData,
        pages: [updatedFirstPage, ...oldData.pages.slice(1)],
      };
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-muted-foreground mb-4 text-xl">
            Please log in to view your feed
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && posts.length === 0) {
    return (
      <div className="space-y-6">
        {/* Post Composer Skeleton */}
        {isAuthenticated && (
          <div className="rounded-2xl border border-tm-border/60 bg-tm-card/90 p-6 backdrop-blur-xl shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-tm-border/60" />
              <div className="h-10 flex-1 animate-pulse rounded-full bg-tm-border/60" />
            </div>
          </div>
        )}
        {/* Post Skeletons */}
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  const errorMessage = isError
    ? (error as any)?.response?.data?.error ||
      (error as any)?.message ||
      'Failed to load feed'
    : null;

  return (
    <div className="space-y-6">
      {/* Post Composer */}
      {isAuthenticated && <PostComposer onPostCreated={handlePostCreated} />}

      {/* Posts Feed */}
      <div className="space-y-6">
        {errorMessage && posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-red-400 mb-4 text-xl">Error loading feed</p>
            <p className="text-tm-text-muted text-sm mb-4">{errorMessage}</p>
            <button
              onClick={() => refetch()}
              className="neon-glow rounded-lg bg-gradient-to-r from-neon-purple-500 to-neon-magenta-500 px-6 py-2 text-white transition-all duration-300 hover:shadow-neon"
              style={{
                background: 'linear-gradient(90deg, #7c5cfc, #e91e63)',
                boxShadow: '0 0 2px rgba(124, 92, 252, 0.3)',
              }}
            >
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-tm-text-muted mb-4 text-xl">No posts yet</p>
            <p className="text-tm-text-muted text-sm">
              Start following people or create your first post!
            </p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}

            {/* Intersection Observer Sentinel */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="h-1 w-full" />
            )}

            {/* Loading More State */}
            {isFetchingNextPage && (
              <div className="flex flex-col items-center justify-center py-8">
                <LoadingSpinner size="md" className="mb-3" />
                <p className="text-tm-text-muted text-sm">Loading more posts...</p>
              </div>
            )}

            {/* Error State for Pagination (only show if we have posts) */}
            {isError && posts.length > 0 && (
              <div className="flex flex-col items-center justify-center py-6">
                <p className="text-tm-text-muted mb-3 text-sm">
                  {errorMessage}
                </p>
                <button
                  onClick={() => fetchNextPage()}
                  className="rounded-lg border border-neon-purple-500/30 bg-neon-purple-500/10 px-4 py-2 text-sm text-neon-purple-400 transition-all hover:bg-neon-purple-500/20"
                >
                  Retry
                </button>
              </div>
            )}

            {/* End of Feed Message */}
            {!hasNextPage && posts.length > 0 && (
              <div className="py-6 text-center">
                <p className="text-tm-text-muted text-sm">You're all caught up!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

