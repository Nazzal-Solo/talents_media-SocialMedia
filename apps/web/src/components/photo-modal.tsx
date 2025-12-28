import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from './ui/smart-image';

interface PhotoModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  alt?: string;
}

export function PhotoModal({
  imageUrl,
  isOpen,
  onClose,
  alt = 'Image',
}: PhotoModalProps) {
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

  // Debug logging in development
  useEffect(() => {
    if (isOpen && import.meta.env.DEV) {
      console.log('[PhotoModal] Opened with imageUrl:', imageUrl);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  // Validate imageUrl before rendering
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    if (import.meta.env.DEV) {
      console.warn('[PhotoModal] Invalid imageUrl:', imageUrl);
    }
    return null;
  }

  // Render modal using portal to avoid CSS conflicts from parent containers
  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      style={{ 
        zIndex: 10000,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[10001] rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
        aria-label="Close image viewer"
        style={{ zIndex: 10001 }}
      >
        <X className="h-6 w-6 text-white" />
      </button>

      <div
        className="relative flex w-full max-w-7xl items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
        style={{ 
          maxHeight: '90vh',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SmartImage
          src={imageUrl}
          alt={alt}
          className="rounded-lg"
          style={{
            maxHeight: '90vh',
            maxWidth: '100%',
            width: 'auto',
            height: 'auto',
          }}
          onClick={onClose}
          aspectRatio="auto"
          objectFit="contain"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );

  // Use portal to render directly to document.body, avoiding parent container CSS conflicts
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

