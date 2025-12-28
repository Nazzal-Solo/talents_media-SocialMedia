import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Newspaper,
  TrendingUp,
  Users,
  Calendar,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { SmartImage } from './ui/smart-image';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  image_url?: string;
  published_at: string;
}

interface AdItem {
  id: string;
  headline: string;
  body: string;
  image_url?: string;
  cta_url: string;
}

interface TrendingHashtag {
  tag: string;
  posts: number;
}

export function Sidebar() {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>(
    []
  );
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);

  // Mock data for demonstration
  const mockNews: NewsItem[] = [
    {
      id: '1',
      title: 'New Social Media Trends for 2024',
      url: 'https://example.com/news/1',
      source: 'Tech News',
      image_url: 'https://picsum.photos/300/200?random=1',
      published_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'The Future of Digital Communication',
      url: 'https://example.com/news/2',
      source: 'Digital Trends',
      image_url: 'https://picsum.photos/300/200?random=1',
      published_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const mockAds: AdItem[] = [
    {
      id: '1',
      headline: 'Discover Amazing Products',
      body: 'Check out our latest collection of innovative products',
      image_url: 'https://picsum.photos/300/200?random=1',
      cta_url: 'https://example.com/shop',
    },
  ];

  useEffect(() => {
    // Debounce initial fetch to avoid excessive requests on mount
    const timeoutId = setTimeout(() => {
      fetchTrendingHashtags();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const fetchTrendingHashtags = async () => {
    setIsLoadingTrending(true);
    try {
      const response = await apiClient.get<{ hashtags: TrendingHashtag[] }>(
        '/api/posts/trending/hashtags?limit=4'
      );
      setTrendingHashtags(response.hashtags || []);
    } catch (error) {
      // Failed to fetch trending hashtags - using fallback
      // Fallback to default hashtags if API fails
      setTrendingHashtags([
        { tag: '#TechNews', posts: 1234 },
        { tag: '#SocialMedia', posts: 856 },
        { tag: '#Innovation', posts: 432 },
        { tag: '#DigitalTrends', posts: 789 },
      ]);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  const handleRefreshNews = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setNews(mockNews);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* News Section */}
      <div className="rounded-xl border border-tm-border/60 bg-tm-card/90 p-4 backdrop-blur-xl shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center space-x-2 text-lg font-semibold">
            <Newspaper className="h-5 w-5 text-tm-secondary" />
            <span>Latest News</span>
          </h3>
          <button
            onClick={handleRefreshNews}
            disabled={isLoading}
            className="rounded p-1 transition-colors hover:bg-white/10"
            title="Refresh news"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        </div>

        <div className="space-y-3">
          {mockNews.map(item => (
            <div key={item.id} className="group cursor-pointer">
              <div className="flex space-x-3">
                {item.image_url && (
                  <SmartImage
                    src={item.image_url}
                    alt={item.title}
                    className="h-16 w-16 rounded-lg"
                    style={{ width: '64px', height: '64px' }}
                    aspectRatio="square"
                    objectFit="cover"
                    fallbackSrc={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.title.charAt(0))}&background=7c5cfc&color=ffffff&size=64`}
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="line-clamp-2 text-sm font-medium text-tm-text transition-colors group-hover:text-tm-secondary">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-tm-text-muted">
                    {item.source} •{' '}
                    {new Date(item.published_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Section */}
      <div className="rounded-xl border border-tm-border/60 bg-tm-card/90 p-4 backdrop-blur-xl shadow-lg"
      >
        <h3 className="mb-4 flex items-center space-x-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-tm-primary-from" />
          <span>Trending</span>
        </h3>

        <div className="space-y-3">
          {isLoadingTrending ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              No trending hashtags yet
            </p>
          ) : (
            trendingHashtags.map(item => (
              <button
                key={item.tag}
                onClick={() => {
                  // Navigate to search page with hashtag
                  navigate(`/search?q=${encodeURIComponent(item.tag)}`);
                }}
                className="group flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-white/10"
              >
                <span className="text-sm font-medium text-tm-text transition-colors group-hover:text-tm-secondary">
                  {item.tag}
                </span>
                <span className="text-xs text-tm-text-muted transition-colors group-hover:text-tm-text">
                  {item.posts.toLocaleString()} posts
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Online Friends */}
      <div className="rounded-xl border border-tm-border/60 bg-tm-card/90 p-4 backdrop-blur-xl shadow-lg"
      >
        <h3 className="mb-4 flex items-center space-x-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-tm-secondary" />
          <span>Online Friends</span>
        </h3>

        <div className="space-y-3">
          {[
            { name: 'John Doe', status: 'online' },
            { name: 'Jane Smith', status: 'away' },
            { name: 'Mike Wilson', status: 'online' },
          ].map(friend => (
            <div key={friend.name} className="flex items-center space-x-3">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-tm-primary-from to-tm-primary-to">
                  <span className="text-xs font-bold text-white">
                    {friend.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </span>
                </div>
                <div
                  className={cn(
                    'border-background absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2',
                    friend.status === 'online'
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                  )}
                />
              </div>
              <span className="text-sm font-medium">{friend.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ads Section */}
      <div className="rounded-xl border border-tm-border/60 bg-tm-card/90 p-4 backdrop-blur-xl shadow-lg"
      >
        <h3 className="mb-4 text-lg font-semibold">Sponsored</h3>

        <div className="space-y-3">
          {mockAds.map(ad => (
            <div key={ad.id} className="group cursor-pointer">
              {ad.image_url && (
                <SmartImage
                  src={ad.image_url}
                  alt={ad.headline}
                  className="mb-3 h-32 w-full rounded-lg"
                  aspectRatio="auto"
                  objectFit="cover"
                  fallbackSrc={`https://ui-avatars.com/api/?name=${encodeURIComponent(ad.headline.charAt(0))}&background=7c5cfc&color=ffffff&size=300`}
                  loading="lazy"
                />
              )}
              <h4 className="text-sm font-medium text-tm-text transition-colors group-hover:text-tm-secondary">
                {ad.headline}
              </h4>
              <p className="mt-1 line-clamp-2 text-xs text-tm-text-muted">
                {ad.body}
              </p>
              <button className="mt-2 flex items-center space-x-1 text-xs text-tm-secondary hover:text-tm-secondary/80 hover:underline">
                <span>Learn More</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

