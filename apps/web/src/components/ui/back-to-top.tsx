import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 300px
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <button
        onClick={scrollToTop}
        className={cn(
          'flex items-center justify-center gap-2',
          'px-6 py-3 rounded-full',
          'bg-gradient-to-r from-tm-primary-from/90 via-tm-primary-to/90 to-tm-secondary/80',
          'border border-tm-border/50',
          'shadow-lg shadow-purple-500/20',
          'backdrop-blur-xl',
          'text-white font-medium',
          'transition-all duration-300',
          'hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-tm-bg',
          'animate-in fade-in slide-in-from-bottom-4',
          'group',
          'glass-card'
        )}
        aria-label="Back to top"
      >
        <ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1" />
        <span className="text-sm">Back to Top</span>
      </button>
    </div>
  );
}

