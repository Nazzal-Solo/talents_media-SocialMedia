import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000
  );

  // Less than 60 seconds - show seconds ago
  if (diffInSeconds < 60) {
    if (diffInSeconds < 1) {
      return 'just now';
    }
    return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  // Less than 60 minutes - show minutes ago
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  // Less than 24 hours - show hours ago
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  // Less than 7 days - show days ago
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  // More than 7 days - show date in format "17 Oct"
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = targetDate.getDate();
  const month = months[targetDate.getMonth()];

  // If it's from the current year, just show day and month
  // If it's from a different year, show day, month, and year
  if (targetDate.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  } else {
    return `${day} ${month} ${targetDate.getFullYear()}`;
  }
}

export function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  }

  if (num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`;
  }

  if (num < 1000000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }

  return `${(num / 1000000000).toFixed(1)}B`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

export function generateAvatarUrl(
  username: string,
  size: number = 150
): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=${size}&background=7c5cfc&color=ffffff&bold=true`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

export function getThemeColors(theme: string) {
  const themes = {
    'dark-neon': {
      primary: '#7c5cfc',
      secondary: '#e91e63',
      accent: '#00e5ff',
      background: '#0b0a1f',
    },
    light: {
      primary: '#3b82f6',
      secondary: '#ef4444',
      accent: '#10b981',
      background: '#ffffff',
    },
    cyan: {
      primary: '#00e5ff',
      secondary: '#06b6d4',
      accent: '#0891b2',
      background: '#001a1a',
    },
    magenta: {
      primary: '#e91e63',
      secondary: '#db2777',
      accent: '#be185d',
      background: '#1a001a',
    },
    violet: {
      primary: '#8b5cf6',
      secondary: '#7c3aed',
      accent: '#6d28d9',
      background: '#1a001a',
    },
  };

  return themes[theme as keyof typeof themes] || themes['dark-neon'];
}

