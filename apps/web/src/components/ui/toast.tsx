import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({
  message,
  type = 'success',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Reset progress and start time
    setProgress(100);
    startTimeRef.current = Date.now();

    // Update progress bar
    const updateInterval = 16; // ~60fps
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        setIsLeaving(true);
        setTimeout(() => {
          setIsVisible(false);
          onClose();
        }, 300); // Match animation duration
      }
    }, updateInterval);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-400" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-500/40 bg-gradient-to-r from-green-500/20 via-green-500/15 to-green-500/10 shadow-lg shadow-green-500/20';
      case 'error':
        return 'border-red-500/40 bg-gradient-to-r from-red-500/20 via-red-500/15 to-red-500/10 shadow-lg shadow-red-500/20';
      case 'info':
        return 'border-blue-500/40 bg-gradient-to-r from-blue-500/20 via-blue-500/15 to-blue-500/10 shadow-lg shadow-blue-500/20';
      default:
        return 'border-green-500/40 bg-gradient-to-r from-green-500/20 via-green-500/15 to-green-500/10 shadow-lg shadow-green-500/20';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-400';
      case 'error':
        return 'bg-red-400';
      case 'info':
        return 'bg-blue-400';
      default:
        return 'bg-green-400';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'group/toast animate-in slide-in-from-bottom-4 relative flex min-w-[320px] max-w-md items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300',
        getStyles(),
        isLeaving
          ? 'animate-out slide-out-to-bottom-4 scale-95 opacity-0'
          : 'scale-100 opacity-100'
      )}
    >
      {/* Progress bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
        <div
          className={cn(
            'h-full transition-all duration-[16ms] ease-linear',
            getProgressColor()
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative z-10 flex-shrink-0">{getIcon()}</div>
      <p className="relative z-10 flex-1 text-sm font-semibold leading-relaxed text-white">
        {message}
      </p>
      <button
        type="button"
        onClick={() => {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          setIsLeaving(true);
          setTimeout(() => {
            setIsVisible(false);
            onClose();
          }, 300);
        }}
        className="group/close relative z-10 flex-shrink-0 rounded-lg p-1.5 transition-all duration-200 hover:scale-110 hover:bg-white/20"
      >
        <X className="h-4 w-4 text-white/70 transition-colors group-hover/close:text-white" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: ToastType }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (toasts.length === 0 || !mounted) return null;

  const content = (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10000] flex -translate-x-1/2 flex-col-reverse gap-3">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}

