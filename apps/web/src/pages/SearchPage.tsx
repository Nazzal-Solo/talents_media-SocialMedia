import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Users,
  Hash,
  Image as ImageIcon,
  Video,
  MapPin,
  TrendingUp,
  UserPlus,
  Sparkles,
  Zap,
  Clock,
  X,
  Trash2,
  ArrowLeft,
  Compass,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { isRequestCanceled } from '@/lib/error-utils';
import { formatDate, formatNumber, generateAvatarUrl } from '@/lib/utils';
import { PostCard } from '@/components/post-card';
import { Post } from '@/store/feed-store';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-context';
import { PostModal } from '@/components/post-modal';
import { SmartImage } from '@/components/ui/smart-image';
import { Avatar } from '@/components/ui/avatar';
import { Helmet } from 'react-helmet-async';

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following?: boolean;
}

interface Hashtag {
  tag: string;
  posts: number;
}

interface SearchResults {
  users: User[];
  posts: Post[];
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'users' | 'posts' | 'hashtags'
  >('all');
  const [results, setResults] = useState<SearchResults>({
    users: [],
    posts: [],
  });
  const [trendingHashtags, setTrendingHashtags] = useState<Hashtag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Explore feed state
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
  const [hasQuickActionTriggered, setHasQuickActionTriggered] = useState(false);
  // Post modal state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  // Individual loading states for Quick Actions (for button states)
  const [loadingQuickAction, setLoadingQuickAction] = useState<{
    users: boolean;
    photos: boolean;
    videos: boolean;
    trending: boolean;
  }>({
    users: false,
    photos: false,
    videos: false,
    trending: false,
  });
  // Unified loading state for main content area
  const [searchContentLoading, setSearchContentLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);
  const previousResultsRef = useRef<SearchResults>({ users: [], posts: [] });

  // Use shared utility function for checking cancellation errors
  const isTimeoutOrCancelError = isRequestCanceled;

  // Defensive filter to exclude current user from results
  const filterCurrentUser = useCallback((users: User[]): User[] => {
    if (!currentUser) return users;
    return users.filter(user => user.id !== currentUser.id);
  }, [currentUser]);

  // Load trending hashtags and explore feed on mount
  useEffect(() => {
    const loadTrendingHashtags = async () => {
      try {
        setIsLoadingTrending(true);
        const response = await apiClient.get<{ hashtags: Hashtag[] }>(
          '/api/posts/trending/hashtags?limit=10'
        );
        setTrendingHashtags(response.hashtags || []);
      } catch (error) {
        console.error('Failed to load trending hashtags:', error);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    loadTrendingHashtags();

    // Load recent searches from localStorage
    const saved = localStorage.getItem('recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
      }
    }
  }, []);

  // Load explore feed when no search is active
  useEffect(() => {
    const shouldShowExplore =
      !query.trim() &&
      !hasQuickActionTriggered &&
      results.users.length === 0 &&
      results.posts.length === 0;

    if (shouldShowExplore && explorePosts.length === 0 && !isLoadingExplore) {
      const loadExploreFeed = async () => {
        try {
          setIsLoadingExplore(true);
          const response = await apiClient.get<{ posts: Post[] }>(
            '/api/posts/explore?page=1&limit=30'
          );
          setExplorePosts(response.posts || []);
        } catch (error) {
          console.error('Failed to load explore feed:', error);
        } finally {
          setIsLoadingExplore(false);
        }
      };
      loadExploreFeed();
    } else if (!shouldShowExplore && explorePosts.length > 0) {
      // Clear explore posts when search becomes active
      setExplorePosts([]);
    }
  }, [
    query,
    hasQuickActionTriggered,
    results.users.length,
    results.posts.length,
    explorePosts.length,
    isLoadingExplore,
  ]);

  // Handle query from URL params (for hashtag clicks)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
      isInitialMount.current = false;
    }
  }, [searchParams]);

  // Dynamic search as user types (debounced)
  useEffect(() => {
    // Skip on initial mount to avoid searching empty query
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Clear results immediately if query is empty
    if (!query.trim()) {
      setResults({ users: [], posts: [] });
      previousResultsRef.current = { users: [], posts: [] };
      setIsLoading(false);
      setSearchError(null);
      setHasQuickActionTriggered(false);
      return;
    }

    // Only search if query has at least 2 characters
    if (query.trim().length < 2) {
      // Keep previous results when query is too short
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Check if we have previous results
    const hasPreviousResults = 
      previousResultsRef.current.users.length > 0 || 
      previousResultsRef.current.posts.length > 0;
    
    // Always set loading state when starting a new search
    // This ensures overlay loader shows when switching filters
    setIsLoading(true);
    setSearchError(null);

    // Debounce search - wait 500ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      const searchTerm = query.trim();
      if (!searchTerm || searchTerm.length < 2) {
        setIsLoading(false);
        return;
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        setIsLoading(false);
        return;
      }

      // Ensure loading state is set (already set above, but ensure it's still true)
      setIsLoading(true);

      try {
        const promises: Promise<any>[] = [];

        // Search users if filter is 'all' or 'users'
        if (activeFilter === 'all' || activeFilter === 'users') {
          promises.push(
            apiClient
              .get<{ users: User[] }>(
                `/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=20`,
                { signal: abortController.signal }
              )
              .then(res => filterCurrentUser(res.users || []))
              .catch(error => {
                // Ignore timeout/cancel errors silently (non-fatal)
                if (isTimeoutOrCancelError(error)) {
                  // Silently ignore - request was intentionally cancelled
                  // Only log in dev mode for debugging
                  if (import.meta.env.DEV) {
                    console.debug('[Search] Users request canceled (ignored)', {
                      query: searchTerm,
                      filter: activeFilter,
                    });
                  }
                  return [];
                }
                // Log real errors
                console.error('[Frontend] Users search error:', error);
                return [];
              })
          );
        } else {
          promises.push(Promise.resolve([]));
        }

        // Search posts if filter is 'all', 'posts', or 'hashtags'
        if (
          activeFilter === 'all' ||
          activeFilter === 'posts' ||
          activeFilter === 'hashtags'
        ) {
          // If hashtags filter is active, add # prefix if not present
          const searchQuery =
            activeFilter === 'hashtags' && !searchTerm.startsWith('#')
              ? `#${searchTerm}`
              : searchTerm;

          const searchUrl = `/api/posts/search?q=${encodeURIComponent(searchQuery)}&limit=20`;
          
          if (import.meta.env.DEV) {
            console.log(
              `[Frontend] Searching posts - filter: ${activeFilter}, original: "${searchTerm}", modified: "${searchQuery}", URL: ${searchUrl}`
            );
          }

          promises.push(
            apiClient
              .get<{ posts: Post[] }>(searchUrl, {
                signal: abortController.signal,
              })
              .then(res => {
                if (import.meta.env.DEV) {
                  console.log(
                    `[Frontend] Search results for "${searchQuery}":`,
                    res.posts
                  );
                  console.log(
                    `[Frontend] Posts count: ${res.posts?.length || 0}`
                  );
                }
                return res.posts || [];
              })
              .catch(error => {
                // Ignore timeout/cancel errors silently (non-fatal)
                if (isTimeoutOrCancelError(error)) {
                  // Silently ignore - request was intentionally cancelled
                  // Only log in dev mode for debugging
                  if (import.meta.env.DEV) {
                    console.debug('[Search] Posts request canceled (ignored)', {
                      query: searchQuery,
                      filter: activeFilter,
                    });
                  }
                  return [];
                }
                // Log real errors
                console.error(
                  `[Frontend] Search error for "${searchQuery}":`,
                  error
                );
                return [];
              })
          );
        } else {
          promises.push(Promise.resolve([]));
        }

        // Check if request was aborted before awaiting
        if (abortController.signal.aborted) {
          return;
        }

        const [users, posts] = await Promise.all(promises);

        // Check again after await (request might have been aborted during await)
        if (abortController.signal.aborted) {
          return;
        }

        const newResults = { users, posts };
        setResults(newResults);
        previousResultsRef.current = newResults;
        
        // Clear error if search succeeded
        if (users.length > 0 || posts.length > 0) {
          setSearchError(null);
        }
      } catch (error: any) {
        // Ignore cancellation/timeout errors (non-fatal)
        if (isTimeoutOrCancelError(error)) {
          // Silently ignore - request was intentionally cancelled
          if (import.meta.env.DEV) {
            console.debug('[Search] Request canceled (ignored)', {
              query: searchTerm,
              filter: activeFilter,
            });
          }
          return;
        }

        // Handle real errors
        console.error('Search failed:', error);
        
        // Only set error if we don't have previous results
        const hasPreviousResults = 
          previousResultsRef.current.users.length > 0 || 
          previousResultsRef.current.posts.length > 0;
        
        if (!hasPreviousResults) {
          setResults({ users: [], posts: [] });
          const errorMessage =
            error.response?.data?.error || error.message || 'Search failed';
          setSearchError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    }, 500);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, activeFilter]);

  const handleSearch = useCallback(
    async (searchQuery?: string, saveToRecent: boolean = true) => {
      const searchTerm = searchQuery || query.trim();
      if (!searchTerm || searchTerm.length < 2) {
        setResults({ users: [], posts: [] });
        previousResultsRef.current = { users: [], posts: [] };
        setIsLoading(false);
        return;
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const hasPreviousResults = 
        previousResultsRef.current.users.length > 0 || 
        previousResultsRef.current.posts.length > 0;

      if (!hasPreviousResults) {
        setIsLoading(true);
      }

      try {
        const searchTermLower = searchTerm.toLowerCase();

        // Save to recent searches only if explicitly requested (e.g., from button click or Enter key)
        if (saveToRecent) {
          setRecentSearches(prev => {
            const newSearches = [
              searchTerm,
              ...prev.filter(s => s.toLowerCase() !== searchTermLower),
            ].slice(0, 10);
            localStorage.setItem(
              'recent-searches',
              JSON.stringify(newSearches)
            );
            return newSearches;
          });
        }

        const promises: Promise<any>[] = [];

        // Search users if filter is 'all' or 'users'
        if (activeFilter === 'all' || activeFilter === 'users') {
          promises.push(
            apiClient
              .get<{ users: User[] }>(
                `/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=20`,
                { signal: abortController.signal }
              )
              .then(res => filterCurrentUser(res.users || []))
              .catch(error => {
                if (isTimeoutOrCancelError(error)) {
                  return [];
                }
                console.error('[Frontend] Users search error:', error);
                return [];
              })
          );
        } else {
          promises.push(Promise.resolve([]));
        }

        // Search posts if filter is 'all', 'posts', or 'hashtags'
        if (
          activeFilter === 'all' ||
          activeFilter === 'posts' ||
          activeFilter === 'hashtags'
        ) {
          // If hashtags filter is active, add # prefix if not present
          const searchQueryModified =
            activeFilter === 'hashtags' && !searchTerm.startsWith('#')
              ? `#${searchTerm}`
              : searchTerm;

          const searchUrl = `/api/posts/search?q=${encodeURIComponent(searchQueryModified)}&limit=20`;
          
          if (import.meta.env.DEV) {
            console.log(
              `[Frontend] Searching posts - filter: ${activeFilter}, original: "${searchTerm}", modified: "${searchQueryModified}", URL: ${searchUrl}`
            );
          }

          promises.push(
            apiClient
              .get<{ posts: Post[] }>(searchUrl, {
                signal: abortController.signal,
              })
              .then(res => {
                if (import.meta.env.DEV) {
                  console.log(
                    `[Frontend] Search results for "${searchQueryModified}":`,
                    res.posts
                  );
                  console.log(
                    `[Frontend] Posts count: ${res.posts?.length || 0}`
                  );
                }
                return res.posts || [];
              })
              .catch(error => {
                // Ignore timeout/cancel errors silently (non-fatal)
                if (isTimeoutOrCancelError(error)) {
                  if (import.meta.env.DEV) {
                    console.debug('[Search] Posts request canceled (ignored)', {
                      query: searchQueryModified,
                      filter: activeFilter,
                    });
                  }
                  return [];
                }
                
                // Log detailed error information for real errors
                const errorMessage =
                  error.response?.data?.error ||
                  error.message ||
                  'Unknown error';
                const statusCode = error.response?.status;
                
                console.error(
                  `[Frontend] Search error for "${searchQueryModified}":`,
                  {
                    message: errorMessage,
                    status: statusCode,
                    url: searchUrl,
                    error: error,
                  }
                );

                // Only set error for non-404/400 errors (network, 500, etc.)
                // 404/400 are expected for "no results" scenarios
                if (statusCode && statusCode >= 500) {
                  setSearchError('Server error. Please try again later.');
                } else if (!statusCode && !hasPreviousResults) {
                  // Network error - only show if no previous data
                  setSearchError(
                    'Network error. Please check your connection.'
                  );
                }
                // For 400/404, silently return empty array (no results is valid)
                return [];
              })
          );
        } else {
          promises.push(Promise.resolve([]));
        }

        // Check if aborted before awaiting
        if (abortController.signal.aborted) {
          return;
        }

        const [users, posts] = await Promise.all(promises);

        // Check again after await
        if (abortController.signal.aborted) {
          return;
        }

        const newResults = { users, posts };
        setResults(newResults);
        previousResultsRef.current = newResults;
        
        // Clear error if search succeeded
        if (users.length > 0 || posts.length > 0) {
          setSearchError(null);
        }
      } catch (error: any) {
        // Ignore cancellation/timeout errors (non-fatal)
        if (isTimeoutOrCancelError(error)) {
          if (import.meta.env.DEV) {
            console.debug('[Search] Request canceled (ignored)', {
              query: searchTerm,
              filter: activeFilter,
            });
          }
          return;
        }

        // Handle real errors
        console.error('Search failed:', error);
        
        // Only set error if we don't have previous results
        if (!hasPreviousResults) {
          setResults({ users: [], posts: [] });
          const errorMessage =
            error.response?.data?.error || error.message || 'Search failed';
          setSearchError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [query, activeFilter, filterCurrentUser]
  );

  const handleHashtagClick = async (tag: string) => {
    // Keep the # in the query when searching for hashtags
    setQuery(tag);
    setActiveFilter('posts');

    // Force search for posts immediately
    setIsLoading(true);
    try {
      const result = await apiClient.get<{ posts: Post[] }>(
        `/api/posts/search?q=${encodeURIComponent(tag)}&limit=20`
      );
      setResults({ users: [], posts: result.posts || [] });
    } catch (error) {
      console.error('Hashtag search failed:', error);
      setResults({ users: [], posts: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    console.log(`[QuickAction] Action triggered: ${action}`);

    // Mark that a quick action was triggered (hide explore feed)
    setHasQuickActionTriggered(true);
    setExplorePosts([]);
    
    // Clear previous results immediately to show loading state
    setResults({ users: [], posts: [] });
    
    // Set unified loading state for main content area
    setSearchContentLoading(true);
    
    // Set loading state for the specific action button
    setLoadingQuickAction(prev => ({ ...prev, [action]: true }));
    
    // Use a flag to ensure loading state resets even if there's an unexpected error
    let loadingReset = false;
    const resetLoading = () => {
      if (!loadingReset) {
        loadingReset = true;
        setSearchContentLoading(false);
        setLoadingQuickAction(prev => ({ ...prev, [action]: false }));
      }
    };
    
    try {
      switch (action) {
        case 'users':
          console.log('[QuickAction] Loading all users...');
          setActiveFilter('users');
          setQuery('');
          // Load all users for "Find Friends"
          const usersResult = await apiClient.get<{ users: User[] }>(
            '/api/users/all?limit=20'
          );
          console.log(
            '[QuickAction] Users loaded:',
            usersResult.users?.length || 0
          );
          setResults({ users: filterCurrentUser(usersResult.users || []), posts: [] });
          resetLoading(); // Clear loading state immediately after results are set
          break;
        case 'photos':
          console.log('[QuickAction] Loading discover posts...');
          setActiveFilter('posts');
          setQuery('');
          // Use the explore endpoint which uses our ranking algorithm
          const discoverResult = await apiClient.get<{ posts: Post[] }>(
            '/api/posts/explore?page=1&limit=20'
          );
          console.log(
            '[QuickAction] Discover posts loaded:',
            discoverResult.posts?.length || 0
          );
          setResults({ users: [], posts: discoverResult.posts || [] });
          resetLoading(); // Clear loading state immediately after results are set
          break;
        case 'videos':
          console.log('[QuickAction] Navigating to reels...');
          // Reset loading state before navigation
          setSearchContentLoading(false);
          setLoadingQuickAction(prev => ({ ...prev, videos: false }));
          // Navigate to reels page instead of searching
          navigate('/reels');
          return; // Exit early since we're navigating away
        case 'trending':
          console.log('[QuickAction] Loading trending posts...');
          setActiveFilter('hashtags');
          setQuery('');
          // Load trending hashtags if not already loaded, then show posts from top hashtag
          let hashtags = trendingHashtags;
          if (hashtags.length === 0) {
            try {
              console.log('[QuickAction] Loading trending hashtags...');
              const trendingResponse = await apiClient.get<{
                hashtags: Hashtag[];
              }>('/api/posts/trending/hashtags?limit=10');
              hashtags = trendingResponse.hashtags || [];
              setTrendingHashtags(hashtags);
              console.log(
                '[QuickAction] Trending hashtags loaded:',
                hashtags.length
              );
            } catch (error) {
              console.error('Failed to load trending hashtags:', error);
            }
          }

          // If we have hashtags, search for posts from the top one
          if (hashtags.length > 0) {
            const topHashtag = hashtags[0].tag;
            console.log(
              '[QuickAction] Searching for posts with hashtag:',
              topHashtag
            );
            const trendingResult = await apiClient.get<{ posts: Post[] }>(
              `/api/posts/search?q=${encodeURIComponent(topHashtag)}&limit=20`
            );
            console.log(
              '[QuickAction] Trending posts loaded:',
              trendingResult.posts?.length || 0
            );
            setResults({ users: [], posts: trendingResult.posts || [] });
            resetLoading(); // Clear loading state immediately after results are set
          } else {
            console.log('[QuickAction] No trending hashtags found');
            setResults({ users: [], posts: [] });
            resetLoading(); // Clear loading state even when no results
          }
          break;
        default:
          console.log(`[QuickAction] Unknown action: ${action}`);
          setResults({ users: [], posts: [] });
          break;
      }
    } catch (error: any) {
      console.error('[QuickAction] Action failed:', action, error);
      setResults({ users: [], posts: [] });
      
      // Show user-friendly error message
      const errorMessage =
        error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')
        ? 'Request timed out. Please try again.'
          : error?.response?.data?.error ||
            error?.message ||
            'Failed to load content. Please try again.';
      
      showToast(errorMessage, 'error');
    } finally {
      // Always reset loading state
      resetLoading();
    }
  };

  const handleFollowUser = async (userId: string, username: string) => {
    try {
      await apiClient.post(`/api/users/${username}/follow`);
      setResults(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === userId ? { ...u, is_following: true } : u
        ),
      }));
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  const handleUnfollowUser = async (userId: string, username: string) => {
    try {
      await apiClient.delete(`/api/users/${username}/follow`);
      setResults(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === userId ? { ...u, is_following: false } : u
        ),
      }));
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const handleClearInput = () => {
    setQuery('');
    setResults({ users: [], posts: [] });
    setHasQuickActionTriggered(false);
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setIsLoading(false);
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  const handleRemoveSearch = (searchToRemove: string) => {
    setRecentSearches(prev => {
      const newSearches = prev.filter(s => s !== searchToRemove);
      localStorage.setItem('recent-searches', JSON.stringify(newSearches));
      return newSearches;
    });
  };

  const totalResults = results.users.length + results.posts.length;
  const hasResults = totalResults > 0;
  // Check if any Quick Action is loading
  const isAnyQuickActionLoading = Object.values(loadingQuickAction).some(Boolean);
  // Show explore feed when no search, no quick action, and no results
  const showExploreFeed =
    !query.trim() &&
    !hasQuickActionTriggered &&
    !hasResults &&
    !isLoading &&
    !searchContentLoading &&
    (explorePosts.length > 0 || isLoadingExplore);
  // Show recent searches only if no results, no query, and no explore feed
  const showRecentSearches =
    !query.trim() &&
    recentSearches.length > 0 &&
    !isLoading &&
    !hasResults &&
    !showExploreFeed &&
    !hasQuickActionTriggered &&
    !searchContentLoading;
  const showEmptyState = query.trim() && !hasResults && !isLoading && !searchContentLoading;
  // Initial load: loading with no data yet (show full loader)
  const showInitialLoading =
    (isLoading || searchContentLoading) && !hasResults && query.trim().length >= 2;
  // Refetch: loading but we have existing results to show (show overlay loader, keep data visible)
  const showOverlayLoading = isLoading && hasResults && !searchContentLoading;
  // Show skeleton grid when Quick Action is loading (main content area)
  const showQuickActionLoading = searchContentLoading && !hasResults;

  return (
    <>
      <Helmet>
        <title>Search - Talents Media</title>
      </Helmet>
      <div className="animated-gradient min-h-screen">
      {/* Sticky Top Navigation Bar */}
      <div className="sticky top-0 z-50 border-b border-tm-border/30 bg-tm-card/95 backdrop-blur-xl">
        <div className="container mx-auto max-w-7xl px-4 py-3">
              <div className="flex items-center gap-3">
            {/* Back Button */}
                <Link
                  to="/"
              className="flex items-center justify-center rounded-xl p-2 text-tm-text-muted transition-all duration-300 hover:bg-tm-card-soft hover:text-tm-text"
                  title="Back to home"
                >
              <ArrowLeft className="h-5 w-5" />
                </Link>

            {/* Search Input - Centered & Dominant */}
            <div className="group/input relative flex flex-1 items-center overflow-hidden rounded-2xl border border-tm-border/40 bg-tm-card-soft/80 transition-all duration-300 focus-within:border-tm-primary-from/60 focus-within:bg-tm-card-soft">
              <Search className="ml-4 h-5 w-5 flex-shrink-0 text-tm-text-muted transition-colors group-focus-within/input:text-tm-primary-from" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => {
                      const newQuery = e.target.value;
                      setQuery(newQuery);
                  setHasQuickActionTriggered(false);
                    }}
                    onKeyPress={e => {
                      if (e.key === 'Enter' && query.trim().length >= 2) {
                        if (searchTimeoutRef.current) {
                          clearTimeout(searchTimeoutRef.current);
                        }
                    handleSearch(query.trim(), true);
                      }
                    }}
                    placeholder="Search for users, posts, hashtags..."
                className="flex-1 bg-transparent px-3 py-3 text-base text-tm-text outline-none placeholder:text-tm-text-muted/60"
                  />
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={handleClearInput}
                  className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-tm-text-muted transition-all hover:text-tm-text"
                    >
                  <X className="h-4 w-4" />
                    </button>
                  )}
                  {isLoading && (
                <div className="mr-2 flex h-8 w-8 items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
                    </div>
                  )}
            </div>

            {/* Filter Icon */}
            <div className="flex items-center gap-2 rounded-xl bg-tm-card-soft/50 px-3 py-2">
              <Filter className="h-5 w-5 text-tm-text-muted" />
              </div>
            </div>

          {/* Tabs - Horizontal Chips in Nav Bar */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {(['all', 'users', 'posts', 'hashtags'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => {
                        setActiveFilter(filter);
                        if (query.trim().length >= 2) {
                          if (searchTimeoutRef.current) {
                            clearTimeout(searchTimeoutRef.current);
                          }
                          handleSearch(query.trim(), false);
                        }
                      }}
                      className={cn(
                  'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-all duration-300',
                        activeFilter === filter
                    ? 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white'
                    : 'bg-tm-card-soft text-tm-text-muted hover:bg-tm-card hover:text-tm-text'
                      )}
                    >
                      {filter}
                    </button>
            ))}
            </div>
          </div>
        </div>

      {/* Recent Searches - Floating Chips (Contextual) */}
      {showRecentSearches && (
        <div className="sticky top-[73px] z-40 border-b border-tm-border/20 bg-tm-card/90 px-4 py-3 backdrop-blur-xl">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {recentSearches.map((search, index) => (
                    <div
                      key={index}
                  className="group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-3 py-1.5 transition-all hover:border-tm-primary-from/50"
                    >
                      <button
                        onClick={() => {
                          setQuery(search);
                          handleSearch(search);
                        }}
                    className="flex items-center gap-1.5 text-sm text-tm-text-muted hover:text-tm-text"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{search}</span>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveSearch(search);
                        }}
                    className="rounded-full p-0.5 text-tm-text-muted hover:text-red-400"
                      >
                    <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
        </div>
      )}

        {/* Main Content - Full Width, Single Column */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        {/* Quick Actions - First Content Block (Horizontal Rail) */}
        <div className="mb-6">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => handleQuickAction('users')}
              disabled={isAnyQuickActionLoading}
              className={cn(
                'group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-4 py-2.5 transition-all',
                isAnyQuickActionLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-tm-primary-from/50 hover:bg-tm-card'
              )}
            >
              {loadingQuickAction.users ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
              ) : (
                <Users className="h-4 w-4 text-tm-text-muted group-hover:text-tm-primary-from" />
              )}
              <span className="text-sm font-semibold text-tm-text">
                {loadingQuickAction.users ? 'Loading...' : 'Find Friends'}
              </span>
            </button>

            <button
              onClick={() => handleQuickAction('photos')}
              disabled={isAnyQuickActionLoading}
              className={cn(
                'group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-4 py-2.5 transition-all',
                isAnyQuickActionLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-tm-primary-from/50 hover:bg-tm-card'
              )}
            >
              {loadingQuickAction.photos ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
              ) : (
                <ImageIcon className="h-4 w-4 text-tm-text-muted group-hover:text-tm-primary-from" />
              )}
              <span className="text-sm font-semibold text-tm-text">
                {loadingQuickAction.photos ? 'Loading...' : 'Discover Posts'}
              </span>
            </button>

            <button
              onClick={() => handleQuickAction('videos')}
              disabled={isAnyQuickActionLoading}
              className={cn(
                'group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-4 py-2.5 transition-all',
                isAnyQuickActionLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-tm-primary-from/50 hover:bg-tm-card'
              )}
            >
              {loadingQuickAction.videos ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
              ) : (
                <Video className="h-4 w-4 text-tm-text-muted group-hover:text-tm-primary-from" />
              )}
              <span className="text-sm font-semibold text-tm-text">
                {loadingQuickAction.videos ? 'Loading...' : 'Discover Reels'}
              </span>
            </button>

            <button
              onClick={() => handleQuickAction('trending')}
              disabled={isAnyQuickActionLoading}
              className={cn(
                'group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-4 py-2.5 transition-all',
                isAnyQuickActionLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-tm-primary-from/50 hover:bg-tm-card'
              )}
            >
              {loadingQuickAction.trending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
              ) : (
                <TrendingUp className="h-4 w-4 text-tm-text-muted group-hover:text-tm-primary-from" />
              )}
              <span className="text-sm font-semibold text-tm-text">
                {loadingQuickAction.trending ? 'Loading...' : 'Trending Now'}
              </span>
            </button>
          </div>
        </div>

        {/* Trending - Inline Module (Between Quick Actions and Explore) */}
        {!query.trim() && trendingHashtags.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-tm-primary-from" />
              <h3 className="text-sm font-semibold text-tm-text">Trending</h3>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
              {trendingHashtags.map(hashtag => (
                <button
                  key={hashtag.tag}
                  onClick={() => handleHashtagClick(hashtag.tag)}
                  className="group flex flex-shrink-0 items-center gap-2 rounded-full border border-tm-border/30 bg-tm-card-soft px-3 py-1.5 transition-all hover:border-tm-primary-from/50 hover:bg-tm-card"
                >
                  <Hash className="h-3.5 w-3.5 text-tm-text-muted group-hover:text-tm-primary-from" />
                  <span className="text-sm font-medium text-tm-text">
                    {hashtag.tag}
                  </span>
                  <span className="text-xs text-tm-text-muted">
                    {formatNumber(hashtag.posts)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area - Explore or Results */}
        {showQuickActionLoading ? (
          /* Quick Action Loading Skeleton - Shows immediately when Quick Action is clicked */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 animate-in fade-in duration-200">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : showInitialLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : showExploreFeed ? (
          /* Explore Grid - Full Width, Primary Content */
          <div>
            {isLoadingExplore ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : explorePosts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {explorePosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="group relative aspect-square overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  >
                    {post.media_url && post.media_type === 'image' ? (
                      <div className="relative h-full w-full overflow-hidden">
                        <SmartImage
                          src={post.media_url}
                          alt={post.text || 'Post'}
                          className="h-full w-full transition-transform duration-700 group-hover:scale-110"
                          aspectRatio="square"
                          objectFit="cover"
                          fallbackSrc={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.display_name?.charAt(0) || 'P')}&background=7c5cfc&color=ffffff&size=400`}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                      </div>
                    ) : post.media_url && post.media_type === 'video' ? (
                      <div className="relative h-full w-full overflow-hidden">
                        <video
                          src={post.media_url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        <div className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1.5 backdrop-blur-md">
                          <Video className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-tm-primary-from/25 via-tm-primary-to/25 to-tm-secondary/25">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Hash className="h-12 w-12 text-tm-text-muted/40" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-3">
                      {post.text && (
                        <p className="mb-2 line-clamp-2 text-xs font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                          {post.text}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            src={post.user?.avatar_url}
                            alt={post.user?.display_name || 'User'}
                            size={16}
                            displayName={post.user?.display_name}
                            username={post.user?.username}
                            className="border border-white/30 ring-1 ring-white/20"
                          />
                          <span className="text-[10px] font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                            {post.user?.display_name || 'User'}
                          </span>
                        </div>
                        {post.reactions && (
                          <div className="flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur-sm">
                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                            <span className="text-[10px] font-semibold text-white">
                              {Object.values(post.reactions).reduce(
                                (a, b) => a + b,
                                0
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedPost(post);
                        setSelectedPostId(post.id);
                      }}
                      className="absolute inset-0 z-10"
                      aria-label="View post"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
            ) : hasResults ? (
          /* Search Results - Replace Explore In-Place */
                <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search Error Message */}
            {searchError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      {searchError}
                    </div>
                  )}
            {/* Users Results - Full Width Rows */}
                {(activeFilter === 'all' || activeFilter === 'users') &&
                  results.users.length > 0 && (
                      <div className="space-y-3">
                        {results.users.filter(user => !currentUser || user.id !== currentUser.id).map(user => (
                          <div
                            key={user.id}
                      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-tm-border/40 bg-tm-card-soft/50 p-4 transition-all hover:bg-tm-card-soft"
                      onClick={() => navigate(`/profile/${user.username}`)}
                          >
                            <Link
                              href={`/profile/${user.username}`}
                              className="relative flex-shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <Avatar
                                src={user.avatar_url}
                                alt={user.display_name}
                                size={56}
                                displayName={user.display_name}
                                username={user.username}
                                className="border-2 border-tm-border/60 transition-all group-hover:scale-105"
                              />
                            </Link>

                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/profile/${user.username}`}
                                onClick={e => e.stopPropagation()}
                                className="block"
                              >
                                <h3 className="truncate font-semibold text-tm-text transition-colors group-hover:text-tm-secondary">
                                  {user.display_name}
                                </h3>
                                <p className="truncate text-sm text-tm-text-muted">
                                  @{user.username}
                                </p>
                                {user.bio && (
                                  <p className="mt-1 line-clamp-1 text-xs text-tm-text-muted">
                                    {user.bio}
                                  </p>
                                )}
                                <div className="mt-1 flex items-center gap-3 text-xs text-tm-text-muted">
                                  <span>
                              {formatNumber(user.followers_count)} followers
                                  </span>
                                  <span>•</span>
                            <span>{formatNumber(user.posts_count)} posts</span>
                                </div>
                              </Link>
                            </div>

                            {currentUser && user.id !== currentUser.id && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (user.is_following) {
                                    handleUnfollowUser(user.id, user.username);
                                  } else {
                                    handleFollowUser(user.id, user.username);
                                  }
                                }}
                                className={cn(
                            'rounded-full px-4 py-2 text-sm font-semibold transition-all',
                                  user.is_following
                                    ? 'border border-tm-border/60 bg-tm-card-soft text-tm-text hover:bg-tm-card'
                              : 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white hover:scale-105'
                                )}
                              >
                                {user.is_following ? (
                                  <span className="flex items-center gap-1">
                                    <UserPlus className="h-4 w-4" />
                                    Following
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <UserPlus className="h-4 w-4" />
                                    Follow
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

            {/* Posts Results - Cards */}
                {(activeFilter === 'all' ||
                  activeFilter === 'posts' ||
                  activeFilter === 'hashtags') &&
                  results.posts.length > 0 && (
                      <div className="space-y-4">
                        {results.posts.map(post => (
                          <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                  )}

            {/* Overlay Loading State */}
                {showOverlayLoading && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-tm-bg/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 rounded-full border border-tm-border/60 bg-tm-card/95 px-4 py-2 shadow-lg backdrop-blur-md">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-tm-primary-from/30 border-t-tm-primary-from" />
                      <span className="text-xs font-medium text-tm-text-muted">
                        Updating results...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : showEmptyState ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="mb-4 h-12 w-12 text-tm-text-muted" />
                <p className="mb-2 text-lg font-semibold text-tm-text">
                  No results found
                </p>
            <p className="text-sm text-tm-text-muted">
                  Try different keywords or check your spelling
                </p>
              </div>
        ) : null}
          </div>

      {/* Post Modal - Full Post Overlay */}
      <PostModal
        postId={selectedPostId}
        post={selectedPost}
        isOpen={!!selectedPostId}
        onClose={() => {
          setSelectedPostId(null);
          setSelectedPost(null);
        }}
        onPostUpdate={(updatedPost) => {
          // Update the post in explorePosts array for real-time updates
          setExplorePosts(prevPosts =>
            prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
          );
          // Also update selectedPost if it's the same post
          if (selectedPost?.id === updatedPost.id) {
            setSelectedPost(updatedPost);
          }
        }}
      />
    </div>
    </>
  );
}
