import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { getInitials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
  displayName?: string;
  username?: string;
}

/**
 * Reusable Avatar component with skeleton loading, fade-in, and proper fallback handling
 * - Shows skeleton placeholder while loading
 * - Smoothly fades in when loaded
 * - Falls back to gradient background with initials if image fails or is missing
 * - Consistent styling across the app matching Talents Media theme
 */
export function Avatar({
  src,
  alt,
  size = 40,
  className,
  displayName,
  username,
}: AvatarProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const fallbackName = displayName || username || 'User';
  const initials = getInitials(fallbackName);
  
  // Reset states when src changes
  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setImageError(false);
    } else {
      setIsLoading(false);
      setImageError(true);
    }
  }, [src]);
  
  // Explicit fallback logic: show fallback ONLY if no src OR image errored
  const showFallback = !src || imageError === true;

  const handleLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full overflow-hidden',
        className
      )}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        backgroundColor: showFallback ? undefined : 'transparent',
      }}
    >
      {/* Skeleton placeholder - shown while loading */}
      {isLoading && src && (
        <Skeleton className="absolute inset-0 z-10 rounded-full" />
      )}

      {showFallback ? (
        // Show fallback: gradient background with initials
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-r from-neon-purple-500 to-neon-magenta-500 font-bold text-white transition-opacity duration-300"
          style={{
            background: 'linear-gradient(90deg, #7c5cfc, #e91e63)',
            fontSize: `${Math.max(10, size * 0.35)}px`,
            opacity: isLoading ? 0 : 1,
          }}
        >
          <span className="text-sm font-semibold text-white">{initials}</span>
        </div>
      ) : (
        // Show image: ONLY the image, no fallback elements
        <img
          src={src}
          alt={alt || displayName || username || 'User avatar'}
          className={cn(
            'h-full w-full rounded-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            width: '100%',
            height: '100%',
          }}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}

