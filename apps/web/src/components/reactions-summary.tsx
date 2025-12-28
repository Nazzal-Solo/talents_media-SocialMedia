import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  Heart,
  Smile,
  Zap,
  Frown,
  Angry,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { formatNumber, generateAvatarUrl } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Skeleton } from './ui/skeleton';
import { Avatar } from './ui/avatar';
import { useAuthStore } from '@/store/auth-store';
import { UserPlus } from 'lucide-react';

interface ReactionUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  kind: string;
  created_at: string;
}

interface ReactionsSummaryProps {
  postId: string;
  reactions: {
    like: number;
    love: number;
    laugh: number;
    wow: number;
    sad: number;
    angry: number;
  };
  getReactionIcon: (reaction: string) => React.ReactNode;
}

const REACTION_TYPES = [
  { key: 'all', label: 'All', icon: null },
  { key: 'like', label: 'Like', icon: ThumbsUp },
  { key: 'love', label: 'Love', icon: Heart },
  { key: 'laugh', label: 'Haha', icon: Smile },
  { key: 'wow', label: 'Wow', icon: Zap },
  { key: 'sad', label: 'Sad', icon: Frown },
  { key: 'angry', label: 'Angry', icon: Angry },
] as const;

function useReactionUsers(
  postId: string,
  kind?: string,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: ['reactionUsers', postId, kind || 'all'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          users: ReactionUser[];
          limit: number;
          offset: number;
        }>(`/api/reactions/post/${postId}/users`, {
          params: kind && kind !== 'all' ? { kind, limit: 50 } : { limit: 50 },
        });
        return response.users || [];
      } catch (error: any) {
        console.error('Failed to fetch reaction users:', error);
        // Return empty array on error instead of throwing
        return [];
      }
    },
    enabled: enabled && !!postId,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function ReactionsSummary({
  postId,
  reactions,
  getReactionIcon,
}: ReactionsSummaryProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverTimeout, setPopoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const { user: currentUser } = useAuthStore();

  // Invalidate reaction users query when reactions change (debounced)
  useEffect(() => {
    const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
    if (totalReactions === 0) return;
    
    const timeoutId = setTimeout(() => {
      // Invalidate all reaction user queries for this post
      queryClient.invalidateQueries({ queryKey: ['reactionUsers', postId] });
    }, 500); // Debounce invalidation by 500ms
    
    return () => clearTimeout(timeoutId);
  }, [JSON.stringify(reactions), postId]); // Use JSON.stringify to avoid object reference changes

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popoverTimeout) {
        clearTimeout(popoverTimeout);
      }
    };
  }, [popoverTimeout]);

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  // Fetch users for popover - always enabled if there are reactions
  const { data: popoverUsers, isLoading: isLoadingPopover, error: popoverError } = useReactionUsers(
    postId,
    undefined,
    totalReactions > 0 // Always fetch if there are reactions
  );

  // Fetch users for modal (with filter)
  const { data: modalUsers, isLoading: isLoadingModal } = useReactionUsers(
    postId,
    selectedFilter === 'all' ? undefined : selectedFilter,
    isModalOpen
  );

  if (totalReactions === 0) {
    return null;
  }

  // Get top reactions (sorted by count, up to 6)
  const topReactions = Object.entries(reactions)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 6)
    .map(([reaction]) => reaction);

  const handleFollow = async (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/api/users/${username}/follow`);
      // Optionally refresh the query
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
              onMouseEnter={() => {
                // Clear any pending close timeout
                if (popoverTimeout) {
                  clearTimeout(popoverTimeout);
                  setPopoverTimeout(null);
                }
                setIsPopoverOpen(true);
              }}
              onMouseLeave={() => {
                // Add small delay before closing to allow moving to popover
                const timeout = setTimeout(() => {
                  setIsPopoverOpen(false);
                }, 200);
                setPopoverTimeout(timeout);
              }}
              className="group inline-flex cursor-pointer items-center space-x-2 rounded-full px-2 py-1 text-sm text-tm-text-muted transition-all hover:text-tm-text hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-neon-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-tm-bg"
            >
              <div className="flex items-center space-x-1.5">
                {topReactions.map((reaction) => {
                  const Icon = REACTION_TYPES.find(t => t.key === reaction)?.icon;
                  return (
                    <span
                      key={reaction}
                      className="flex items-center space-x-1 text-tm-text transition-transform duration-200 group-hover:scale-110"
                      title={REACTION_TYPES.find(t => t.key === reaction)?.label}
                    >
                      {Icon ? (
                        <Icon className={cn(
                          'h-4 w-4',
                          reaction === 'like' && 'text-neon-cyan-400',
                          reaction === 'love' && 'text-neon-magenta-400',
                          reaction === 'laugh' && 'text-amber-400',
                          reaction === 'wow' && 'text-neon-purple-400',
                          reaction === 'sad' && 'text-blue-400',
                          reaction === 'angry' && 'text-red-400'
                        )} />
                      ) : (
                        getReactionIcon(reaction)
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="font-medium text-tm-text">
                {formatNumber(totalReactions)} reactions
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-80 p-0 border border-tm-border/50 bg-tm-card/98 backdrop-blur-xl shadow-2xl min-h-[140px] max-h-[400px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onMouseEnter={() => {
              // Clear close timeout when mouse enters popover
              if (popoverTimeout) {
                clearTimeout(popoverTimeout);
                setPopoverTimeout(null);
              }
            }}
            style={{
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(124, 92, 252, 0.1)',
            }}
          >
          <div className="p-4">
            <div className="mb-3 pb-2 border-b border-tm-border/30">
              <div className="text-xs font-semibold text-tm-text uppercase tracking-wider">
                Recent Reactions
              </div>
              {totalReactions > 0 && (
                <div className="text-xs text-tm-text-muted mt-1">
                  {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                </div>
              )}
            </div>
            {isLoadingPopover ? (
              <div className="space-y-2.5 py-1">
                {[...Array(Math.min(3, totalReactions || 3))].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : popoverError ? (
              <div className="py-6 text-center">
                <div className="text-sm font-medium text-tm-text-muted">
                  Failed to load reactions
                </div>
                <div className="text-xs text-tm-text-muted/70 mt-1">
                  Please try again later
                </div>
              </div>
            ) : popoverUsers && popoverUsers.length > 0 ? (
              <div className="space-y-0.5 max-h-64 overflow-y-auto scrollbar-hide -mr-1 pr-1">
                {popoverUsers.slice(0, 10).map((user, index) => (
                  <div
                    key={user.user_id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2.5 transition-all hover:bg-tm-card-soft/80 cursor-pointer group",
                      index === 0 && "bg-tm-card-soft/40"
                    )}
                    onClick={() => {
                      navigate(`/profile/${user.username}`);
                      setIsPopoverOpen(false);
                    }}
                  >
                    <Avatar
                      src={user.avatar_url}
                      alt={user.display_name}
                      size={40}
                      className="ring-2 ring-tm-border/50 group-hover:ring-neon-purple-500/50 transition-all flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-tm-text truncate group-hover:text-neon-purple-400 transition-colors">
                        {user.display_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-tm-text-muted truncate">
                        @{user.username || 'unknown'}
                      </div>
                    </div>
                    <div className="flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                      {getReactionIcon(user.kind)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                {totalReactions > 0 ? (
                  <>
                    <div className="text-sm font-medium text-tm-text-muted mb-1">
                      Loading reactions...
                    </div>
                    <div className="text-xs text-tm-text-muted/70">
                      {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-tm-text-muted mb-1">
                      No reactions yet
                    </div>
                    <div className="text-xs text-tm-text-muted/70">
                      Be the first to react!
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reactions</DialogTitle>
          </DialogHeader>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 border-b border-tm-border/30">
            {REACTION_TYPES.map((type) => {
              const count =
                type.key === 'all'
                  ? totalReactions
                  : reactions[type.key as keyof typeof reactions] || 0;
              const Icon = type.icon;
              const isActive = selectedFilter === type.key;

              return (
                <button
                  key={type.key}
                  onClick={() => setSelectedFilter(type.key)}
                  className={cn(
                    'flex flex-shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-neon-purple-500/20 text-neon-purple-400 border border-neon-purple-500/30'
                      : 'text-tm-text-muted hover:text-tm-text hover:bg-tm-card-soft'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{type.label}</span>
                  {count > 0 && (
                    <span className="text-xs opacity-70">({count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto mt-4">
            {isLoadingModal ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : modalUsers && modalUsers.length > 0 ? (
              <div className="space-y-2">
                {modalUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-tm-card-soft"
                  >
                    <Avatar
                      src={user.avatar_url}
                      alt={user.display_name}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold text-tm-text cursor-pointer hover:text-neon-purple-400 transition-colors"
                        onClick={() => {
                          navigate(`/profile/${user.username}`);
                          setIsModalOpen(false);
                        }}
                      >
                        {user.display_name}
                      </div>
                      <div className="text-xs text-tm-text-muted">
                        @{user.username}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {getReactionIcon(user.kind)}
                      </div>
                      {currentUser &&
                        currentUser.id !== user.user_id && (
                          <button
                            onClick={(e) => handleFollow(user.username, e)}
                            className="rounded-full bg-gradient-to-r from-neon-purple-500 to-neon-cyan-500 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:scale-105"
                          >
                            <UserPlus className="h-3 w-3 inline mr-1" />
                            Follow
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-2 text-4xl">
                  {selectedFilter !== 'all' &&
                    getReactionIcon(selectedFilter)}
                </div>
                <div className="text-sm font-medium text-tm-text">
                  No {selectedFilter !== 'all' ? REACTION_TYPES.find(t => t.key === selectedFilter)?.label.toLowerCase() : ''} reactions yet
                </div>
                <div className="text-xs text-tm-text-muted mt-1">
                  Be the first to react!
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

