import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PostCard } from './post-card';
import { Post } from '@/store/feed-store';
import { apiClient } from '@/lib/api-client';
import { useState } from 'react';
import { Skeleton } from './ui/skeleton';

// Add styles for modal-specific image/video sizing - match feed post style
const modalStyles = `
  /* Image/video sizing in modal - centered and properly sized */
  .post-modal-content img[alt="Post media"] {
    max-height: 60vh !important;
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
    display: block !important;
    margin: 0 auto !important;
  }
  .post-modal-content video {
    max-height: 60vh !important;
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
    display: block !important;
    margin: 0 auto !important;
  }
  /* Image container - ensure proper centering */
  .post-modal-content .mt-4.flex.cursor-pointer {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  }
  /* Reactions bar - keep attached, no sticky styling */
  .post-modal-content .flex.items-center.justify-between.border-t {
    position: relative !important;
    margin-top: 1rem !important;
  }
`;

interface PostModalProps {
  postId: string | null;
  post?: Post | null; // Optional: if post data is already available
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (updatedPost: Post) => void; // Callback to update parent state
}

export function PostModal({
  postId,
  post: initialPost,
  isOpen,
  onClose,
  onPostUpdate,
}: PostModalProps) {
  const [post, setPost] = useState<Post | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState(!initialPost);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPost(null);
      setIsLoading(false);
      setIsImageLoaded(false);
      setIsVideoLoaded(false);
    }
  }, [isOpen]);

  // Fetch post if we only have ID
  useEffect(() => {
    if (isOpen && postId) {
      if (initialPost) {
        setPost(initialPost);
        setIsLoading(false);
        // Reset media loading states - if no media, consider it "loaded"
        const hasImage = initialPost.media_url && initialPost.media_type === 'image';
        const hasVideo = initialPost.media_url && initialPost.media_type === 'video';
        setIsImageLoaded(!hasImage);
        setIsVideoLoaded(!hasVideo);
        
        // If there's media, wait a bit then check if it's already cached
        if (hasImage || hasVideo) {
          const checkMediaLoad = () => {
            if (hasImage && initialPost.media_url) {
              const img = new Image();
              img.onload = () => setIsImageLoaded(true);
              img.onerror = () => setIsImageLoaded(true);
              img.src = initialPost.media_url;
            }
            if (hasVideo && initialPost.media_url) {
              const vid = document.createElement('video');
              vid.onloadeddata = () => setIsVideoLoaded(true);
              vid.onerror = () => setIsVideoLoaded(true);
              vid.src = initialPost.media_url;
              vid.preload = 'metadata';
            }
          };
          // Small delay to let PostCard render first
          setTimeout(checkMediaLoad, 100);
        }
      } else {
        const fetchPost = async () => {
          try {
            setIsLoading(true);
            setIsImageLoaded(false);
            setIsVideoLoaded(false);
            const response = await apiClient.get<{ post: Post }>(
              `/api/posts/${postId}`
            );
            setPost(response.post);
            // Reset media loading states based on media type
            const hasImage = response.post.media_url && response.post.media_type === 'image';
            const hasVideo = response.post.media_url && response.post.media_type === 'video';
            setIsImageLoaded(!hasImage);
            setIsVideoLoaded(!hasVideo);
            
            // Check if media is already cached
            if (hasImage && response.post.media_url) {
              const img = new Image();
              img.onload = () => setIsImageLoaded(true);
              img.onerror = () => setIsImageLoaded(true);
              img.src = response.post.media_url;
            }
            if (hasVideo && response.post.media_url) {
              const vid = document.createElement('video');
              vid.onloadeddata = () => setIsVideoLoaded(true);
              vid.onerror = () => setIsVideoLoaded(true);
              vid.src = response.post.media_url;
              vid.preload = 'metadata';
            }
          } catch (error) {
            console.error('Failed to fetch post:', error);
            onClose(); // Close modal on error
          } finally {
            setIsLoading(false);
          }
        };
        fetchPost();
      }
    }
  }, [isOpen, postId, initialPost, onClose]);

  // Handle post updates from PostCard
  const handlePostUpdate = (updatedPost: Post) => {
    setPost(updatedPost);
    if (onPostUpdate) {
      onPostUpdate(updatedPost);
    }
  };

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      <style>{modalStyles}</style>
      <div
        className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-6 transition-all duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      >
        {/* Close Button - Better positioned and styled */}
        <button
          onClick={handleClose}
          className="absolute right-6 top-6 z-[10001] flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 p-2.5 transition-all duration-200 hover:bg-black/80 hover:border-white/20 hover:scale-110 active:scale-95 shadow-lg"
          aria-label="Close post"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Modal Container - Match feed post width */}
        <div
          className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col transition-all duration-300 ${
            isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Main Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {isLoading || (post && post.media_type === 'image' && !isImageLoaded) || (post && post.media_type === 'video' && !isVideoLoaded) ? (
              <div className="rounded-2xl border border-tm-border/50 bg-gradient-to-br from-tm-card/90 via-tm-card/85 to-tm-card-soft/80 p-6 shadow-lg backdrop-blur-xl space-y-4">
                {/* Header skeleton */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                {/* Text skeleton */}
                {post?.text && <Skeleton className="h-20 w-full rounded-lg" />}
                {/* Media skeleton - centered */}
                {post?.media_url && (
                  <div className="flex justify-center">
                    <Skeleton className={`rounded-xl ${post.media_type === 'image' ? 'h-[400px] w-full max-w-full' : 'h-[300px] w-full'}`} />
                  </div>
                )}
                {/* Action bar skeleton */}
                <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              </div>
            ) : post ? (
              <div className="post-modal-content">
                <PostCard 
                  post={post} 
                  isInModal={true}
                  onPostUpdate={handlePostUpdate}
                />
                {/* Image/Video load detection */}
                {post.media_type === 'image' && post.media_url && (
                  <img
                    src={post.media_url}
                    alt=""
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={() => setIsImageLoaded(true)}
                  />
                )}
                {post.media_type === 'video' && post.media_url && (
                  <video
                    src={post.media_url}
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                    onLoadedData={() => setIsVideoLoaded(true)}
                    onError={() => setIsVideoLoaded(true)}
                    preload="metadata"
                  />
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-tm-border/50 bg-gradient-to-br from-tm-card/90 via-tm-card/85 to-tm-card-soft/80 p-12 text-center shadow-lg backdrop-blur-xl">
                <p className="text-tm-text-muted mb-4">Failed to load post</p>
                <button
                  onClick={handleClose}
                  className="rounded-lg bg-gradient-to-r from-tm-primary-from to-tm-primary-to px-6 py-3 text-white font-medium transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

