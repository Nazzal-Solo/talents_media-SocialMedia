import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  MessageCircle,
  Share,
  MoreHorizontal,
  ThumbsUp,
  Smile,
  Zap,
  Frown,
  Angry,
  Send,
  Edit,
  Trash2,
  EyeOff,
  Flag,
  X,
  Image,
  Video,
  MapPin,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Post, Comment } from '@/store/feed-store';
import { formatDate, formatNumber, generateAvatarUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { PhotoModal } from './photo-modal';
import { useFeedStore } from '@/store/feed-store';
import { useToast } from './ui/toast-context';
import { Avatar } from './ui/avatar';
import { ReactionsSummary } from './reactions-summary';
import { SmartImage } from './ui/smart-image';

interface PostCardProps {
  post: Post;
  isInModal?: boolean;
  onPostUpdate?: (updatedPost: Post) => void;
}

// CommentItem component for rendering individual comments with reactions and replies
function CommentItem({
  comment,
  postId,
  onReply,
}: {
  comment: Comment;
  postId: string;
  onReply: (commentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const { user } = useAuthStore();

  const fetchReplies = async () => {
    try {
      const response = await apiClient.get<{ comments: Comment[] }>(
        `/api/comments/comment/${comment.id}`
      );
      setReplies(response.comments || []);
    } catch (error) {
      console.error('Failed to fetch replies:', error);
    }
  };

  useEffect(() => {
    if (showReplies && comment.replies_count && comment.replies_count > 0) {
      fetchReplies();
    }
  }, [showReplies, comment.replies_count]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = replyText.trim();
    if (!trimmedText || isLoadingReply) return;

    setIsLoadingReply(true);
    try {
      const response = await apiClient.post<{ comment: Comment }>(
        `/api/comments/post/${postId}`,
        {
          text: trimmedText,
          parent_id: comment.id,
        }
      );
      setReplies(prev => [response.comment, ...prev]);
      setReplyText('');
      setShowReplies(true);
    } catch (error: any) {
      console.error('Failed to post reply:', error);
    } finally {
      setIsLoadingReply(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Avatar
          src={comment.user?.avatar_url}
          alt={comment.user?.display_name || 'User'}
          size={32}
          displayName={comment.user?.display_name}
          username={comment.user?.username}
        />
        <div className="flex-1">
          <div className="rounded-lg bg-tm-card-soft p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-tm-text">
                {comment.user?.display_name || 'User'}
              </span>
              <span className="text-xs text-tm-text-muted">
                {formatDate(comment.created_at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-tm-text">
              {comment.text}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-tm-text-muted">
            <button
              onClick={() => onReply(comment.id)}
              className="transition-colors hover:text-tm-text"
            >
              Reply
            </button>
            {comment.replies_count && comment.replies_count > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="transition-colors hover:text-tm-text"
              >
                {showReplies ? 'Hide' : 'Show'} {comment.replies_count} replies
              </button>
            )}
          </div>
        </div>
      </div>
      {showReplies && (
        <div className="ml-11 space-y-2">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-3">
              <Avatar
                src={reply.user?.avatar_url}
                alt={reply.user?.display_name || 'User'}
                size={24}
                displayName={reply.user?.display_name}
                username={reply.user?.username}
              />
              <div className="flex-1">
                <div className="rounded-lg bg-tm-card-soft p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-tm-text">
                      {reply.user?.display_name || 'User'}
                    </span>
                    <span className="text-xs text-tm-text-muted">
                      {formatDate(reply.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-tm-text">
                    {reply.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {user && (
            <form onSubmit={handleReplySubmit} className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg border border-tm-border bg-tm-card px-3 py-2 text-sm text-tm-text outline-none placeholder:text-tm-text-muted focus:border-tm-primary-from"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isLoadingReply}
                className="rounded-lg bg-tm-primary-from px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function PostCardComponent({
  post,
  isInModal = false,
  onPostUpdate,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [userReaction, setUserReaction] = useState<string | undefined>(
    post.user_reaction
  );
  const [reactions, setReactions] = useState(
    post.reactions || { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0 }
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComment, setIsLoadingComment] = useState(false);
  const [isLoadingReaction, setIsLoadingReaction] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoModalImageUrl, setPhotoModalImageUrl] = useState<string | null>(
    null
  );
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const { user } = useAuthStore();
  const { updatePost } = useFeedStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  useEffect(() => {
    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout);
      }
    };
  }, [menuTimeout]);

  const fetchComments = async () => {
    try {
      const response = await apiClient.get<{ comments: Comment[] }>(
        `/api/comments/post/${post.id}`
      );
      setComments(response.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleReaction = async (
    reactionType: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
  ) => {
    if (isLoadingReaction) return;

    setIsLoadingReaction(true);

    try {
      const prevReaction = userReaction;
      let updatedReactions = { ...reactions };
      let newUserReaction: string | undefined = reactionType;

      if (userReaction === reactionType) {
        // Remove reaction
        try {
          await apiClient.delete(`/api/reactions/post/${post.id}`);
        } catch (error: any) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }
        newUserReaction = undefined;
        updatedReactions = {
          ...reactions,
          [reactionType]: Math.max(0, reactions[reactionType] - 1),
        };
        setTimeout(() => setShowReactionsMenu(false), 200);
      } else {
        // Add/switch reaction
        await apiClient.post(`/api/reactions/post/${post.id}`, {
          kind: reactionType,
        });

        updatedReactions = { ...reactions };
        if (prevReaction) {
          updatedReactions[prevReaction as keyof typeof updatedReactions] =
            Math.max(
              0,
              updatedReactions[prevReaction as keyof typeof updatedReactions] -
                1
            );
        }
        updatedReactions[reactionType] =
          (updatedReactions[reactionType] || 0) + 1;
      }

      // Update local state
      setUserReaction(newUserReaction);
      setReactions(updatedReactions);

      // Update store
      const updatedPost = {
        ...post,
        user_reaction: newUserReaction,
        reactions: updatedReactions,
      };
      updatePost(post.id, {
        user_reaction: newUserReaction,
        reactions: updatedReactions,
      });

      // Call onPostUpdate callback if provided (for real-time updates)
      if (onPostUpdate) {
        onPostUpdate(updatedPost);
      }
    } catch (error: any) {
      console.error('Failed to toggle reaction:', error);
      showToast('Failed to update reaction', 'error');
    } finally {
      setIsLoadingReaction(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = commentText.trim();
    if (!trimmedText || isLoadingComment) return;

    setIsLoadingComment(true);
    try {
      const response = await apiClient.post<{ comment: Comment }>(
        `/api/comments/post/${post.id}`,
        { text: trimmedText }
      );
      setComments(prev => [response.comment, ...prev]);
      setCommentText('');

      // Update post comments count
      const updatedPost = {
        ...post,
        comments_count: (post.comments_count || 0) + 1,
      };
      updatePost(post.id, {
        comments_count: updatedPost.comments_count,
      });

      if (onPostUpdate) {
        onPostUpdate(updatedPost);
      }

      showToast('Comment added', 'success');
    } catch (error: any) {
      console.error('Failed to post comment:', error);
      showToast('Failed to post comment', 'error');
    } finally {
      setIsLoadingComment(false);
    }
  };

  const getReactionIcon = (
    reaction: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | string
  ) => {
    switch (reaction) {
      case 'like':
        return <ThumbsUp className="h-4 w-4" />;
      case 'love':
        return <Heart className="h-4 w-4" />;
      case 'laugh':
        return <Smile className="h-4 w-4" />;
      case 'wow':
        return <Zap className="h-4 w-4" />;
      case 'sad':
        return <Frown className="h-4 w-4" />;
      case 'angry':
        return <Angry className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-tm-border/50 bg-gradient-to-br from-tm-card/90 via-tm-card/85 to-tm-card-soft/80 p-6 shadow-lg backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            src={post.user?.avatar_url}
            alt={post.user?.display_name || 'User'}
            size={40}
            displayName={post.user?.display_name}
            username={post.user?.username}
          />
          <div>
            <div className="font-semibold text-tm-text">
              {post.user?.display_name || 'User'}
            </div>
            <div className="text-sm text-tm-text-muted">
              {formatDate(post.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        {post.text && (
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-tm-text">
            {post.text}
          </p>
        )}

        {post.media_url && post.media_type === 'image' && (
          <SmartImage
            src={post.media_url}
            alt="Post media"
            className={cn(
              'mt-4 cursor-pointer rounded-xl transition-transform duration-300',
              isInModal ? '' : 'hover:scale-[1.02]'
            )}
            style={
              isInModal
                ? { maxHeight: '60vh', maxWidth: '100%', width: 'auto', height: 'auto' }
                : { maxHeight: '600px', width: '100%' }
            }
            onClick={() => {
              if (post.media_url && post.media_type === 'image' && !isInModal) {
                setPhotoModalImageUrl(post.media_url);
                setShowPhotoModal(true);
              }
            }}
            aspectRatio="auto"
            objectFit="contain"
            fallbackSrc={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.display_name?.charAt(0) || 'P')}&background=7c5cfc&color=ffffff&size=600`}
            loading={isInModal ? 'eager' : 'lazy'}
          />
        )}

        {post.media_url && post.media_type === 'video' && (
          <div className="mt-4 flex items-center justify-center overflow-hidden rounded-lg">
            <video
              src={post.media_url}
              controls
              className={cn(
                'h-auto',
                isInModal ? 'max-h-[60vh] w-auto max-w-full' : 'max-h-96 w-full'
              )}
            />
          </div>
        )}
      </div>

      {/* Reactions Summary */}
      <ReactionsSummary
        postId={post.id}
        reactions={reactions}
        getReactionIcon={getReactionIcon}
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center space-x-6">
          {/* Reactions Button with Hover Menu */}
          <div
            className="group relative"
            onMouseEnter={() => {
              if (!isLoadingReaction) {
                if (menuTimeout) {
                  clearTimeout(menuTimeout);
                  setMenuTimeout(null);
                }
                setShowReactionsMenu(true);
              }
            }}
            onMouseLeave={() => {
              const timeout = setTimeout(() => {
                setShowReactionsMenu(false);
              }, 100);
              setMenuTimeout(timeout);
            }}
          >
            {showReactionsMenu && (
              <div
                className="pointer-events-auto absolute bottom-full left-0 z-50 mb-2 flex items-center space-x-1.5 rounded-full border border-neon-purple-500/20 bg-tm-card/95 px-3 py-2 shadow-2xl backdrop-blur-xl transition-all duration-200"
                style={{
                  animation: 'fadeInScale 0.2s ease-out',
                  transformOrigin: 'bottom left',
                  boxShadow: '0 8px 32px rgba(124, 92, 252, 0.2), 0 0 0 1px rgba(34, 211, 238, 0.1)',
                }}
                onMouseEnter={() => {
                  if (menuTimeout) {
                    clearTimeout(menuTimeout);
                    setMenuTimeout(null);
                  }
                  setShowReactionsMenu(true);
                }}
                onMouseLeave={() => {
                  setShowReactionsMenu(false);
                }}
              >
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('like');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'like'
                      ? 'bg-neon-cyan-500/20 ring-2 ring-neon-cyan-400/60 scale-110 shadow-lg shadow-neon-cyan-500/30 animate-bounce-select'
                      : 'hover:bg-neon-cyan-500/15 hover:scale-110 hover:shadow-md hover:shadow-neon-cyan-500/20'
                  )}
                  title="Like"
                >
                  <ThumbsUp className={cn(
                    'h-5 w-5 transition-all duration-300',
                    userReaction === 'like'
                      ? 'text-neon-cyan-400 scale-110'
                      : 'text-neon-cyan-400/80 group-hover/reaction:text-neon-cyan-400 group-hover/reaction:scale-110'
                  )} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('love');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'love'
                      ? 'bg-neon-magenta-500/20 ring-2 ring-neon-magenta-400/60 scale-110 shadow-lg shadow-neon-magenta-500/30 animate-bounce-select'
                      : 'hover:bg-neon-magenta-500/15 hover:scale-110 hover:shadow-md hover:shadow-neon-magenta-500/20'
                  )}
                  title="Love"
                >
                  <Heart
                    className={cn(
                      'h-5 w-5 transition-all duration-300',
                      userReaction === 'love'
                        ? 'text-neon-magenta-400 scale-110 fill-current'
                        : 'text-neon-magenta-400/80 group-hover/reaction:text-neon-magenta-400 group-hover/reaction:scale-110'
                    )}
                    fill={userReaction === 'love' ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('laugh');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'laugh'
                      ? 'bg-amber-500/20 ring-2 ring-amber-400/60 scale-110 shadow-lg shadow-amber-500/30 animate-bounce-select'
                      : 'hover:bg-amber-500/15 hover:scale-110 hover:shadow-md hover:shadow-amber-500/20'
                  )}
                  title="Haha"
                >
                  <Smile className={cn(
                    'h-5 w-5 transition-all duration-300',
                    userReaction === 'laugh'
                      ? 'text-amber-400 scale-110'
                      : 'text-amber-400/80 group-hover/reaction:text-amber-400 group-hover/reaction:scale-110'
                  )} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('wow');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'wow'
                      ? 'bg-neon-purple-500/20 ring-2 ring-neon-purple-400/60 scale-110 shadow-lg shadow-neon-purple-500/30 animate-bounce-select'
                      : 'hover:bg-neon-purple-500/15 hover:scale-110 hover:shadow-md hover:shadow-neon-purple-500/20'
                  )}
                  title="Wow"
                >
                  <Zap className={cn(
                    'h-5 w-5 transition-all duration-300',
                    userReaction === 'wow'
                      ? 'text-neon-purple-400 scale-110'
                      : 'text-neon-purple-400/80 group-hover/reaction:text-neon-purple-400 group-hover/reaction:scale-110'
                  )} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('sad');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'sad'
                      ? 'bg-blue-500/20 ring-2 ring-blue-400/60 scale-110 shadow-lg shadow-blue-500/30 animate-bounce-select'
                      : 'hover:bg-blue-500/15 hover:scale-110 hover:shadow-md hover:shadow-blue-500/20'
                  )}
                  title="Sad"
                >
                  <Frown className={cn(
                    'h-5 w-5 transition-all duration-300',
                    userReaction === 'sad'
                      ? 'text-blue-400 scale-110'
                      : 'text-blue-400/80 group-hover/reaction:text-blue-400 group-hover/reaction:scale-110'
                  )} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleReaction('angry');
                  }}
                  className={cn(
                    'group/reaction flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                    userReaction === 'angry'
                      ? 'bg-red-500/20 ring-2 ring-red-400/60 scale-110 shadow-lg shadow-red-500/30 animate-bounce-select'
                      : 'hover:bg-red-500/15 hover:scale-110 hover:shadow-md hover:shadow-red-500/20'
                  )}
                  title="Angry"
                >
                  <Angry className={cn(
                    'h-5 w-5 transition-all duration-300',
                    userReaction === 'angry'
                      ? 'text-red-400 scale-110'
                      : 'text-red-400/80 group-hover/reaction:text-red-400 group-hover/reaction:scale-110'
                  )} />
                </button>
              </div>
            )}
            <button
              onClick={() =>
                handleReaction(
                  (userReaction as
                    | 'like'
                    | 'love'
                    | 'laugh'
                    | 'wow'
                    | 'sad'
                    | 'angry') || 'like'
                )
              }
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-200',
                userReaction
                  ? 'text-neon-purple-400 hover:text-neon-purple-300'
                  : 'text-tm-text-muted hover:text-tm-text hover:bg-tm-card-soft/50'
              )}
            >
              {userReaction ? (
                <span className="transition-transform duration-200 hover:scale-110">
                  {getReactionIcon(
                    userReaction as
                      | 'like'
                      | 'love'
                      | 'laugh'
                      | 'wow'
                      | 'sad'
                      | 'angry'
                  )}
                </span>
              ) : (
                <ThumbsUp className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              )}
              <span className="font-medium">React</span>
            </button>
          </div>

          <button
            onClick={() => setShowComments(!showComments)}
            className="group flex items-center gap-2 rounded-lg px-4 py-2 text-tm-text-muted transition-all duration-200 hover:text-tm-text hover:bg-tm-card-soft/50"
          >
            <MessageCircle className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">Comment</span>
          </button>

          <button className="group flex items-center gap-2 rounded-lg px-4 py-2 text-tm-text-muted transition-all duration-200 hover:text-tm-text hover:bg-tm-card-soft/50">
            <Share className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {user && (
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-lg border border-tm-border bg-tm-card-soft px-4 py-2 text-tm-text outline-none placeholder:text-tm-text-muted focus:border-tm-primary-from"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isLoadingComment}
                className="rounded-lg bg-tm-primary-from px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingComment ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                onReply={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && photoModalImageUrl && (
        <PhotoModal
          imageUrl={photoModalImageUrl}
          isOpen={showPhotoModal}
          onClose={() => {
            setShowPhotoModal(false);
            setPhotoModalImageUrl(null);
          }}
        />
      )}
    </div>
  );
}

export const PostCard = memo(PostCardComponent);
