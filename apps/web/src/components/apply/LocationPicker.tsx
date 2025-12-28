import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { MapPin, X, Loader2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Location {
  display_name: string;
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  location_type?: 'remote' | 'onsite' | 'hybrid';
}

interface LocationPickerProps {
  value: Location[];
  onChange: (locations: Location[]) => void;
  className?: string;
  profileContext?: {
    selectedSkills?: string[];
    selectedJobTitles?: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
    locations?: string[];
  };
}

export function LocationPicker({ value, onChange, className, profileContext = {} }: LocationPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const debouncedInput = useDebouncedValue(inputValue, 300);

  // Memoize context query key
  const contextQueryKey = useMemo(() => {
    return JSON.stringify({
      selectedSkills: profileContext.selectedSkills || [],
      selectedJobTitles: profileContext.selectedJobTitles || [],
      includeKeywords: profileContext.includeKeywords || [],
      excludeKeywords: profileContext.excludeKeywords || [],
      locations: profileContext.locations || [],
    });
  }, [
    profileContext.selectedSkills,
    profileContext.selectedJobTitles,
    profileContext.includeKeywords,
    profileContext.excludeKeywords,
    profileContext.locations,
  ]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['apply-locations-suggestions', debouncedInput, contextQueryKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedInput || '',
        limit: '20',
      });

      // Append context parameters
      if (profileContext.selectedSkills?.length) {
        params.append('selectedSkills', profileContext.selectedSkills.join(','));
      }
      if (profileContext.selectedJobTitles?.length) {
        params.append('selectedJobTitles', profileContext.selectedJobTitles.join(','));
      }
      if (profileContext.includeKeywords?.length) {
        params.append('includeKeywords', profileContext.includeKeywords.join(','));
      }
      if (profileContext.excludeKeywords?.length) {
        params.append('excludeKeywords', profileContext.excludeKeywords.join(','));
      }
      if (profileContext.locations?.length) {
        params.append('locations', JSON.stringify(profileContext.locations));
      }

      const response = await apiClient.get(`/api/apply/locations/suggestions?${params.toString()}`);
      console.log('Location suggestions response:', response); // Debug log
      return response;
    },
    enabled: isOpen && (debouncedInput.length >= 2 || debouncedInput.length === 0),
    staleTime: 5 * 1000, // Cache for 5 seconds
    retry: 1,
  });

  const response = (data as any) || {};
  const matches = response.matches || [];
  const recommended = response.recommended || [];
  const allLocations = [...recommended, ...matches];

  // Filter out already selected locations
  const filteredLocations = allLocations.filter(
    (loc: any) => !value.some(v => 
      v.display_name.toLowerCase() === loc.display_name?.toLowerCase() &&
      (v.location_type || 'onsite') === (loc.type === 'remote' ? 'remote' : 'onsite')
    )
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addLocation = (locationData: any) => {
    // Convert suggestion format to Location format
    const location: Location = {
      display_name: locationData.display_name || locationData.value,
      country: locationData.country,
      city: locationData.city,
      region: locationData.region,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location_type: locationData.type === 'remote' ? 'remote' : 'onsite',
    };

    // Check for duplicates (case-insensitive display_name + location_type)
    if (
      value.some(
        v =>
          v.display_name.toLowerCase() === location.display_name.toLowerCase() &&
          v.location_type === location.location_type
      )
    ) {
      showToast('Location already added', 'error');
      return;
    }

    onChange([...value, location]);
    setInputValue('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const removeLocation = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addRemote = () => {
    const remoteLocation: Location = {
      display_name: 'Remote',
      location_type: 'remote',
    };
    addLocation(remoteLocation);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await apiClient.get(
            `/api/apply/locations/reverse?lat=${latitude}&lon=${longitude}`
          );
          const location = (response as any).location;
          if (location) {
            addLocation(location);
          } else {
            showToast('Could not determine your location', 'error');
          }
        } catch (error) {
          showToast('Failed to get location details', 'error');
        } finally {
          setIsGettingLocation(false);
        }
      },
      error => {
        showToast('Failed to get your location. Please check permissions.', 'error');
        setIsGettingLocation(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredLocations[highlightedIndex]) {
        addLocation(filteredLocations[highlightedIndex]);
      } else if (inputValue.trim()) {
        // Allow custom location entry as fallback
        const customLocation: Location = {
          display_name: inputValue.trim(),
          location_type: 'onsite',
        };
        addLocation(customLocation);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredLocations.length - 1 ? prev + 1 : prev));
      setIsOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={isGettingLocation}
          className="flex items-center gap-2 px-4 py-2 bg-tm-primary-from/20 text-tm-primary-from rounded-lg hover:bg-tm-primary-from/30 transition disabled:opacity-50"
        >
          {isGettingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Use My Location
        </button>
        <button
          type="button"
          onClick={addRemote}
          className="flex items-center gap-2 px-4 py-2 bg-tm-primary-from/20 text-tm-primary-from rounded-lg hover:bg-tm-primary-from/30 transition"
        >
          <MapPin className="h-4 w-4" />
          Add Remote
        </button>
      </div>

      {/* Selected locations */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((location, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1 bg-tm-primary-from/20 text-tm-text rounded-full text-sm"
            >
              <MapPin className="h-3 w-3" />
              {location.display_name}
              {location.location_type && (
                <span className="text-xs text-tm-text-muted">
                  ({location.location_type})
                </span>
              )}
              <button
                type="button"
                onClick={() => removeLocation(index)}
                className="hover:text-red-500 transition-colors"
                aria-label={`Remove ${location.display_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a city, region, or country..."
          className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-tm-text-muted" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (debouncedInput.length >= 2 || debouncedInput.length === 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-tm-card border border-tm-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {error && (
            <div className="px-4 py-2 text-sm text-red-500">
              Error loading suggestions: {(error as any)?.message || 'Unknown error'}
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-tm-primary-from" />
            </div>
          ) : filteredLocations.length > 0 ? (
            <ul className="py-1">
              {recommended.length > 0 && (
                <>
                  <li className="px-4 py-2 text-xs text-tm-text-muted uppercase font-semibold">
                    Recommended for you
                  </li>
                  {recommended
                    .filter((loc: any) => !value.some(v => 
                      v.display_name.toLowerCase() === loc.display_name?.toLowerCase()
                    ))
                    .map((location: any, index: number) => (
                      <li
                        key={`rec-${index}`}
                        onClick={() => addLocation(location)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={cn(
                          'px-4 py-2 cursor-pointer transition-colors',
                          highlightedIndex === index
                            ? 'bg-tm-primary-from/20 text-tm-primary-from'
                            : 'hover:bg-tm-bg/50'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{location.display_name}</div>
                            {location.city && location.country && (
                              <div className="text-xs text-tm-text-muted">
                                {location.city}, {location.country}
                              </div>
                            )}
                            {location.type === 'remote' && (
                              <div className="text-xs text-tm-text-muted">Remote work</div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  {matches.length > 0 && (
                    <li className="px-4 py-2 text-xs text-tm-text-muted uppercase font-semibold border-t border-tm-border mt-1">
                      Matches
                    </li>
                  )}
                </>
              )}
              {matches
                .filter((loc: any) => !value.some(v => 
                  v.display_name.toLowerCase() === loc.display_name?.toLowerCase()
                ))
                .map((location: any, index: number) => (
                  <li
                    key={`match-${index}`}
                    onClick={() => addLocation(location)}
                    onMouseEnter={() => setHighlightedIndex(recommended.length + index)}
                    className={cn(
                      'px-4 py-2 cursor-pointer transition-colors',
                      highlightedIndex === recommended.length + index
                        ? 'bg-tm-primary-from/20 text-tm-primary-from'
                        : 'hover:bg-tm-bg/50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{location.display_name}</div>
                        {location.city && location.country && (
                          <div className="text-xs text-tm-text-muted">
                            {location.city}, {location.country}
                          </div>
                        )}
                        {location.type === 'remote' && (
                          <div className="text-xs text-tm-text-muted">Remote work</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          ) : (debouncedInput.length >= 2 || debouncedInput.length === 0) ? (
            <div className="px-4 py-2 text-sm text-tm-text-muted">
              No locations found. Press Enter to add "{inputValue}" as custom location
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

