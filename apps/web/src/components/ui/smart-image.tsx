import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  fallbackSrc?: string;
  aspectRatio?: 'square' | 'video' | 'auto' | string; // 'auto' means no fixed aspect ratio
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * SmartImage component with skeleton loading, fade-in animation, and error handling
 * - Shows skeleton placeholder while loading
 * - Smoothly fades in when loaded
 * - Shows fallback on error
 * - Prevents layout shift by reserving space
 */
export function SmartImage({
  src,
  alt,
  className,
  style,
  onClick,
  fallbackSrc,
  aspectRatio = 'auto',
  objectFit = 'contain',
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
}: SmartImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(src || null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset states when src changes
  useEffect(() => {
    if (src) {
      setImageSrc(src);
      setIsLoading(true);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    
    // Try fallback if available and not already using it
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setIsLoading(true);
      return;
    }
    
    // No fallback or fallback also failed
    setHasError(true);
    onError?.();
  };

  // Determine aspect ratio class
  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio !== 'auto'
      ? `aspect-[${aspectRatio}]`
      : '';

  // If no src and no fallback, show error placeholder
  if (!imageSrc && !fallbackSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-tm-card-soft',
          aspectClass,
          className
        )}
        style={style}
      >
        <div className="text-center text-tm-text-muted">
          <p className="text-sm">Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        aspectClass,
        onClick && 'cursor-pointer'
      )}
      style={style}
      onClick={onClick}
    >
      {/* Skeleton placeholder - shown while loading */}
      {isLoading && (
        <Skeleton
          className={cn(
            'absolute inset-0 z-10',
            aspectRatio === 'auto' ? 'h-full w-full min-h-[400px]' : 'h-full w-full',
            'rounded-xl shadow-lg'
          )}
        />
      )}

      {/* Error placeholder - shown when image fails to load */}
      {hasError && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-tm-card-soft">
          <div className="text-center text-tm-text-muted">
            <p className="text-xs">Image unavailable</p>
          </div>
        </div>
      )}

      {/* Actual image */}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            hasError && 'hidden',
            `object-${objectFit}`,
            aspectRatio === 'auto' ? 'h-auto w-full' : 'h-full w-full',
            className
          )}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
          onError={handleError}
          style={
            aspectRatio === 'auto'
              ? { width: '100%', height: 'auto', ...style }
              : { width: '100%', height: '100%', ...style }
          }
        />
      )}
    </div>
  );
}

