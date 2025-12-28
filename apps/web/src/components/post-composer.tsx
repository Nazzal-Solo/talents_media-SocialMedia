import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Image, Video, Smile, MapPin, Send, X } from 'lucide-react';
import { cn, generateAvatarUrl } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Post } from '@/store/feed-store';
import { Avatar } from './ui/avatar';
import { useToast } from './ui/toast-context';
import { SmartImage } from './ui/smart-image';
import {
  reverseGeocode,
  searchLocations,
  type LocationData,
} from '@/lib/geocoding';

interface PostComposerProps {
  onPostCreated?: (post: Post) => void;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'none'>(
    'none'
  );
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');
  const [showFeelingMenu, setShowFeelingMenu] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<
    LocationData[]
  >([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [feelingMenuPosition, setFeelingMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [locationMenuPosition, setLocationMenuPosition] = useState<{
    top: number;
    left: number;
    positionAbove: boolean;
    availableHeight: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const feelingButtonRef = useRef<HTMLButtonElement>(null);
  const locationButtonRef = useRef<HTMLButtonElement>(null);
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const feelings = [
    'Happy',
    'Sad',
    'Excited',
    'Grateful',
    'Loved',
    'Blessed',
    'Thankful',
    'Hopeful',
    'Proud',
    'Content',
    'Anxious',
    'Stressed',
    'Tired',
    'Confused',
    'Angry',
  ];

  // Calculate feeling menu position
  useEffect(() => {
    if (showFeelingMenu && feelingButtonRef.current) {
      const buttonRect = feelingButtonRef.current.getBoundingClientRect();
      setFeelingMenuPosition({
        top: buttonRect.bottom + window.scrollY + 8,
        left: buttonRect.left + window.scrollX,
      });
    } else {
      setFeelingMenuPosition(null);
    }
  }, [showFeelingMenu]);

  // Calculate location menu position
  useEffect(() => {
    if (showLocationInput && locationButtonRef.current) {
      const buttonRect = locationButtonRef.current.getBoundingClientRect();
      const menuHeight = 400; // Approximate menu height
      const spaceAbove = buttonRect.top;
      const spaceBelow = window.innerHeight - buttonRect.bottom;

      // Position above if there's more space, otherwise below
      const positionAbove = spaceAbove > spaceBelow || spaceAbove > menuHeight;

      const topPosition = positionAbove
        ? buttonRect.top + window.scrollY
        : buttonRect.bottom + window.scrollY + 8;

      const availableHeight = positionAbove
        ? buttonRect.top - 20
        : window.innerHeight - buttonRect.bottom - 28;

      setLocationMenuPosition({
        top: topPosition,
        left: Math.max(
          8,
          Math.min(buttonRect.left + window.scrollX, window.innerWidth - 336)
        ), // 336 = w-80 (320px) + padding
        positionAbove,
        availableHeight: Math.min(400, availableHeight),
      });
    } else {
      setLocationMenuPosition(null);
    }
  }, [showLocationInput]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setMediaType('image');
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedVideo(reader.result as string);
        setMediaType('video');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleVideoUpload = () => {
    videoInputRef.current?.click();
  };

  const removeMedia = () => {
    setSelectedImage(null);
    setSelectedVideo(null);
    setMediaType('none');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow posting if there's text, media, feeling, or location
    if (
      (!text.trim() && mediaType === 'none' && !feeling && !location) ||
      isLoading
    )
      return;

    setIsLoading(true);
    try {
      // For now, we'll use the data URL as media_url
      // In production, you'd upload to Cloudinary or similar service first
      const mediaUrl = selectedImage || selectedVideo || undefined;

      // If only feeling or location is selected (no text), auto-generate text
      let postText = text.trim();
      if (!postText && feeling && mediaType === 'none' && !location) {
        postText = `${user?.display_name || 'User'} feeling ${feeling}`;
      } else if (!postText && location && mediaType === 'none' && !feeling) {
        postText = `${user?.display_name || 'User'} is currently in ${location}`;
      } else if (!postText && feeling && location && mediaType === 'none') {
        postText = `${user?.display_name || 'User'} feeling ${feeling} in ${location}`;
      }

      const response = await apiClient.post<{ post: Post }>('/api/posts', {
        text: postText || undefined,
        media_url: mediaUrl,
        media_type: mediaType,
        visibility: 'public',
        feeling: feeling || undefined,
        location: location || undefined,
      });

      // Reset form
      setText('');
      setIsExpanded(false);
      setSelectedImage(null);
      setSelectedVideo(null);
      setMediaType('none');
      setFeeling('');
      setLocation('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';

      // Show success toast
      showToast('Post created successfully!', 'success');

      // Notify parent component
      if (onPostCreated) {
        onPostCreated(response.post);
      }
    } catch (error: any) {
      // Failed to create post - error handled by toast
      showToast('Failed to create post. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="group/composer relative overflow-hidden rounded-2xl border border-tm-border/60 bg-tm-card/90 p-6 backdrop-blur-xl shadow-lg transition-all duration-300 hover:border-tm-border hover:bg-tm-card-soft/90"
    >
      {/* Subtle gradient overlay - disabled to prevent glow */}
      {/* <div className="absolute inset-0 -z-0 rounded-2xl bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 transition-opacity duration-300 group-hover/composer:opacity-100" /> */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Avatar and Input */}
        <div className="relative z-10 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            {/* Disabled glow effect to prevent glow on other sections */}
            {/* <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 blur-md transition-opacity duration-300 group-hover/composer:opacity-30" /> */}
            <Avatar
              src={user?.avatar_url}
              alt={user?.display_name || 'You'}
              size={48}
              displayName={user?.display_name}
              username={user?.username}
              className="border-2 border-white/20 shadow-lg ring-2 ring-white/10 transition-all duration-300 hover:scale-105 hover:border-white/30 hover:ring-white/20"
            />
          </div>

          <div className="flex-1">
            <textarea
              value={text}
              onChange={e => {
                setText(e.target.value);
                // Auto-expand when typing
                if (!isExpanded && e.target.value.trim()) {
                  setIsExpanded(true);
                }
              }}
              onFocus={() => {
                if (!isExpanded) {
                  setIsExpanded(true);
                }
              }}
              onBlur={() => {
                // Only collapse if there's no text and no media
                if (
                  !text.trim() &&
                  mediaType === 'none' &&
                  !feeling &&
                  !location
                ) {
                  setIsExpanded(false);
                }
              }}
              placeholder="What's on your mind?"
              className="w-full resize-none overflow-hidden rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-base leading-relaxed text-white placeholder-white/50 outline-none backdrop-blur-sm transition-all duration-300 focus:border-purple-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-purple-500/20 focus:ring-2 focus:ring-purple-500/30"
              style={{
                height: 'auto',
                minHeight: '48px',
                maxHeight: '160px',
              }}
              rows={1}
              disabled={isLoading}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                const scrollHeight = target.scrollHeight;
                const newHeight = Math.min(Math.max(scrollHeight, 48), 160);
                target.style.height = `${newHeight}px`;
              }}
              onKeyDown={e => {
                // Auto-grow on Enter key
                const target = e.target as HTMLTextAreaElement;
                setTimeout(() => {
                  target.style.height = 'auto';
                  const scrollHeight = target.scrollHeight;
                  const newHeight = Math.min(Math.max(scrollHeight, 48), 160);
                  target.style.height = `${newHeight}px`;
                }, 0);
              }}
            />

            {/* Preview Media */}
            {selectedImage && (
              <div className="group/media relative mt-4 max-w-md overflow-hidden rounded-xl border-2 border-white/10 shadow-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl">
                <SmartImage
                  src={selectedImage}
                  alt="Preview"
                  className="h-auto max-h-64 w-full transition-transform duration-300 group-hover/media:scale-105"
                  aspectRatio="auto"
                  objectFit="cover"
                  loading="eager"
                />
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute right-3 top-3 rounded-full bg-black/70 p-2.5 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-black/90"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            )}

            {selectedVideo && (
              <div className="group/media relative mt-4 max-w-md overflow-hidden rounded-xl border-2 border-white/10 shadow-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl">
                <video
                  src={selectedVideo}
                  controls
                  className="h-auto max-h-64 w-full"
                />
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute right-3 top-3 rounded-full bg-black/70 p-2.5 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-black/90"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            )}

            {/* Feeling and Location Display */}
            {(feeling || location) && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                {feeling && (
                  <span className="group/tag flex items-center gap-2 rounded-full border border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 shadow-lg shadow-cyan-500/20 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-gradient-to-r hover:from-cyan-500/30 hover:to-cyan-500/20 hover:shadow-cyan-500/30">
                    <Smile className="h-4 w-4 transition-transform duration-300 group-hover/tag:rotate-12 group-hover/tag:scale-110" />
                    <span>Feeling {feeling}</span>
                  </span>
                )}
                {location && (
                  <span className="group/tag flex items-center gap-2 rounded-full border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 shadow-lg shadow-emerald-500/20 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/50 hover:bg-gradient-to-r hover:from-emerald-500/30 hover:to-emerald-500/20 hover:shadow-emerald-500/30">
                    <MapPin className="h-4 w-4 transition-transform duration-300 group-hover/tag:rotate-12 group-hover/tag:scale-110" />
                    <span>{location}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 transition-all duration-300 w-full">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Media Upload */}
            <button
              type="button"
              onClick={handleImageUpload}
              disabled={isLoading}
              className={cn(
                'group/photo flex items-center gap-2.5 rounded-full border-0 px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 shadow-none outline-none',
                selectedImage
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-white/5 text-white/70 hover:bg-purple-500/10 hover:text-purple-300 focus:outline-none focus:ring-0'
              )}
              style={{
                boxShadow: 'none',
                outline: 'none',
                border: selectedImage ? '1px solid rgba(168, 85, 247, 0.6)' : 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
              onMouseEnter={e => {
                if (!selectedImage) {
                  e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.6)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backdropFilter = 'none';
                  e.currentTarget.style.WebkitBackdropFilter = 'none';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                }
              }}
              onMouseLeave={e => {
                if (!selectedImage) {
                  e.currentTarget.style.border = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backdropFilter = 'none';
                  e.currentTarget.style.WebkitBackdropFilter = 'none';
                  e.currentTarget.style.background = '';
                }
              }}
            >
              <Image className="h-5 w-5 transition-transform duration-300 group-hover/photo:rotate-3 group-hover/photo:scale-110" />
              <span className="hidden sm:block">Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Video Upload */}
            <button
              type="button"
              onClick={handleVideoUpload}
              disabled={isLoading}
              className={cn(
                'group/video flex items-center gap-2.5 rounded-full border-0 px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 shadow-none outline-none',
                selectedVideo
                  ? 'bg-pink-500/20 text-pink-300'
                  : 'bg-white/5 text-white/70 hover:bg-pink-500/10 hover:text-pink-300 focus:outline-none focus:ring-0'
              )}
              style={{
                boxShadow: 'none',
                outline: 'none',
                border: selectedVideo ? '1px solid rgba(236, 72, 153, 0.6)' : 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
              onMouseEnter={e => {
                if (!selectedVideo) {
                  e.currentTarget.style.border = '1px solid rgba(236, 72, 153, 0.6)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backdropFilter = 'none';
                  e.currentTarget.style.WebkitBackdropFilter = 'none';
                  e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
                }
              }}
              onMouseLeave={e => {
                if (!selectedVideo) {
                  e.currentTarget.style.border = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backdropFilter = 'none';
                  e.currentTarget.style.WebkitBackdropFilter = 'none';
                  e.currentTarget.style.background = '';
                }
              }}
            >
              <Video className="h-5 w-5 transition-transform duration-300 group-hover/video:rotate-3 group-hover/video:scale-110" />
              <span className="hidden sm:block">Video</span>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Feeling */}
            <div className="relative">
              <button
                ref={feelingButtonRef}
                type="button"
                onClick={() => setShowFeelingMenu(!showFeelingMenu)}
                disabled={isLoading}
                className={cn(
                  'group/feeling flex items-center gap-2.5 rounded-full border-0 px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 shadow-none outline-none',
                  feeling
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-white/5 text-white/70 hover:bg-cyan-500/10 hover:text-cyan-300 focus:outline-none focus:ring-0'
                )}
                style={{
                  boxShadow: 'none',
                  outline: 'none',
                  border: feeling ? '1px solid rgba(34, 211, 238, 0.6)' : 'none',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}
                onMouseEnter={e => {
                  if (!feeling) {
                    e.currentTarget.style.border = '1px solid rgba(34, 211, 238, 0.6)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backdropFilter = 'none';
                    e.currentTarget.style.WebkitBackdropFilter = 'none';
                    e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)';
                  }
                }}
                onMouseLeave={e => {
                  if (!feeling) {
                    e.currentTarget.style.border = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backdropFilter = 'none';
                    e.currentTarget.style.WebkitBackdropFilter = 'none';
                    e.currentTarget.style.background = '';
                  }
                }}
              >
                <Smile className="h-5 w-5 transition-transform duration-300 group-hover/feeling:rotate-3 group-hover/feeling:scale-110" />
                <span className="hidden sm:block">
                  {feeling ? `Feeling ${feeling}` : 'Feeling'}
                </span>
              </button>

              {showFeelingMenu &&
                feelingMenuPosition &&
                typeof window !== 'undefined' &&
                createPortal(
                  <div
                    className="feeling-menu fixed z-[9999] max-h-56 w-56 overflow-y-auto rounded-xl border-0 bg-gradient-to-br from-white/[0.12] to-white/[0.08] p-2 shadow-none"
                    style={{
                      top: `${feelingMenuPosition.top}px`,
                      left: `${feelingMenuPosition.left}px`,
                      boxShadow: 'none',
                      border: 'none',
                      outline: 'none',
                      backdropFilter: 'none',
                      WebkitBackdropFilter: 'none',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFeeling('');
                        setShowFeelingMenu(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10 outline-none shadow-none"
                      style={{ boxShadow: 'none', outline: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.outline = 'none';
                        e.currentTarget.style.backdropFilter = 'none';
                        e.currentTarget.style.WebkitBackdropFilter = 'none';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.outline = 'none';
                        e.currentTarget.style.backdropFilter = 'none';
                        e.currentTarget.style.WebkitBackdropFilter = 'none';
                      }}
                    >
                      None
                    </button>
                    {feelings.map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setFeeling(f);
                          setShowFeelingMenu(false);
                        }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-white/10 hover:pl-4 outline-none shadow-none',
                          feeling === f
                            ? 'bg-cyan-500/20 font-medium text-cyan-400'
                            : 'text-white'
                        )}
                        style={{ boxShadow: 'none', outline: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.backdropFilter = 'none';
                          e.currentTarget.style.WebkitBackdropFilter = 'none';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.backdropFilter = 'none';
                          e.currentTarget.style.WebkitBackdropFilter = 'none';
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
            </div>

            {/* Location */}
            <div className="relative">
              <button
                ref={locationButtonRef}
                type="button"
                onClick={async () => {
                  const newShowState = !showLocationInput;
                  setShowLocationInput(newShowState);

                  if (newShowState && navigator.geolocation) {
                    setIsSearchingLocation(true);
                    navigator.geolocation.getCurrentPosition(
                      async position => {
                        try {
                          const locationData = await reverseGeocode(
                            position.coords.latitude,
                            position.coords.longitude
                          );
                          if (locationData) {
                            setLocation(locationData.displayName);
                          } else {
                            setLocation(
                              `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
                            );
                          }
                        } catch (error) {
                          // Failed to reverse geocode - location will be empty
                        } finally {
                          setIsSearchingLocation(false);
                        }
                      },
                      () => {
                        // Error getting location - user can search manually
                        setIsSearchingLocation(false);
                      }
                    );
                  }
                }}
                disabled={isLoading}
                className={cn(
                  'group/location flex items-center gap-2.5 rounded-full border-0 px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 shadow-none outline-none',
                  location
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/5 text-white/70 hover:bg-emerald-500/10 hover:text-emerald-300 focus:outline-none focus:ring-0'
                )}
                style={{
                  boxShadow: 'none',
                  outline: 'none',
                  border: location ? '1px solid rgba(16, 185, 129, 0.6)' : 'none',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}
                onMouseEnter={e => {
                  if (!location) {
                    e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.6)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backdropFilter = 'none';
                    e.currentTarget.style.WebkitBackdropFilter = 'none';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  }
                }}
                onMouseLeave={e => {
                  if (!location) {
                    e.currentTarget.style.border = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backdropFilter = 'none';
                    e.currentTarget.style.WebkitBackdropFilter = 'none';
                    e.currentTarget.style.background = '';
                  }
                }}
              >
                <MapPin className="h-5 w-5 transition-transform duration-300 group-hover/location:rotate-3 group-hover/location:scale-110" />
                <span className="hidden sm:block">Location</span>
              </button>

              {showLocationInput &&
                locationMenuPosition &&
                typeof window !== 'undefined' &&
                createPortal(
                  <div
                    className="location-input fixed z-[9999] w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border-0 bg-gradient-to-br from-white/10 to-white/5 p-3 shadow-none"
                    style={{
                      top: `${locationMenuPosition.top}px`,
                      left: `${locationMenuPosition.left}px`,
                      transform: locationMenuPosition.positionAbove
                        ? 'translateY(-100%)'
                        : 'none',
                      marginTop: locationMenuPosition.positionAbove
                        ? '-8px'
                        : '8px',
                      maxHeight: `${locationMenuPosition.availableHeight}px`,
                      boxShadow: 'none',
                      border: 'none',
                      outline: 'none',
                      backdropFilter: 'none',
                      WebkitBackdropFilter: 'none',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="relative mb-3">
                      <input
                        type="text"
                        value={locationSearchQuery}
                        onChange={async e => {
                          const query = e.target.value;
                          setLocationSearchQuery(query);

                          if (query.length > 2) {
                            setIsSearchingLocation(true);
                            const results = await searchLocations(query);
                            setLocationSearchResults(results);
                            setIsSearchingLocation(false);
                          } else {
                            setLocationSearchResults([]);
                          }
                        }}
                        placeholder="Search for city or country..."
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder-white/40 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                        autoFocus
                      />
                      {isSearchingLocation && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                        </div>
                      )}
                    </div>

                    {/* Search Results */}
                    {locationSearchQuery.length > 2 &&
                      locationSearchResults.length > 0 && (
                        <div className="mb-3 max-h-48 space-y-1 overflow-y-auto rounded-lg">
                          {locationSearchResults.map((loc, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setLocation(loc.displayName);
                                setLocationSearchQuery('');
                                setLocationSearchResults([]);
                                setShowLocationInput(false);
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-white transition-all duration-200 hover:bg-white/10 hover:pl-4 outline-none shadow-none"
                              style={{ boxShadow: 'none', outline: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
                              onMouseEnter={e => {
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.outline = 'none';
                                e.currentTarget.style.backdropFilter = 'none';
                                e.currentTarget.style.WebkitBackdropFilter = 'none';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.outline = 'none';
                                e.currentTarget.style.backdropFilter = 'none';
                                e.currentTarget.style.WebkitBackdropFilter = 'none';
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-400" />
                                <span>{loc.displayName}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                    {/* Current Location */}
                    {location && (
                      <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-green-300">
                          <MapPin className="h-4 w-4" />
                          <span>{location}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocation('');
                          setLocationSearchQuery('');
                          setLocationSearchResults([]);
                          setShowLocationInput(false);
                        }}
                        className="rounded px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/10"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocationSearchQuery('');
                          setLocationSearchResults([]);
                          setShowLocationInput(false);
                        }}
                        className="rounded bg-green-500/20 px-3 py-1 text-xs text-green-400 transition-colors hover:bg-green-500/30"
                      >
                        Done
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          </div>

          {/* Post Button */}
          <button
            type="submit"
            disabled={
              (!text.trim() && mediaType === 'none' && !feeling && !location) ||
              isLoading
            }
            className={cn(
              'group/post relative isolate flex items-center gap-3 overflow-hidden rounded-full px-8 py-3.5 font-bold text-white shadow-lg transition-all duration-300 shrink-0',
              (text.trim() || mediaType !== 'none' || feeling || location) &&
                !isLoading
                ? 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to hover:brightness-110 hover:scale-[1.01] active:scale-[0.98]'
                : 'cursor-not-allowed bg-tm-card-soft text-tm-text-muted shadow-none'
            )}
          >
            {/* Animated effects for active button */}
            {(text.trim() || mediaType !== 'none' || feeling || location) &&
              !isLoading && (
                <>
                  <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-gradient-to-r from-tm-primary-from/50 to-tm-primary-to/50 opacity-0 blur-2xl transition-opacity duration-500 group-hover/post:opacity-30" />
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover/post:translate-x-full" />
                </>
              )}
            <div className="relative z-10 flex items-center gap-3">
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  <span className="text-base">Posting...</span>
                </>
              ) : (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-white/40 opacity-0 blur-md transition-opacity duration-300 group-hover/post:opacity-100" />
                    <div className="relative rounded-full bg-white/25 p-1.5 backdrop-blur-sm transition-all duration-300 group-hover/post:rotate-12 group-hover/post:scale-110 group-hover/post:bg-white/35">
                      <Send className="relative z-10 h-4 w-4 text-white transition-transform duration-300 group-hover/post:-translate-y-0.5 group-hover/post:translate-x-0.5" />
                    </div>
                  </div>
                  <span className="text-base tracking-wide drop-shadow-lg">
                    Post
                  </span>
                </>
              )}
            </div>
          </button>
        </div>
      </form>

      {/* Click outside to close feeling/location menus */}
      {(showFeelingMenu || showLocationInput) && (
        <div
          className="fixed inset-0 z-40"
          onClick={e => {
            // Don't close if clicking inside the menu
            if (
              (e.target as HTMLElement).closest('.feeling-menu') ||
              (e.target as HTMLElement).closest('.location-input')
            ) {
              return;
            }
            setShowFeelingMenu(false);
            setShowLocationInput(false);
          }}
        />
      )}
    </div>
  );
}
