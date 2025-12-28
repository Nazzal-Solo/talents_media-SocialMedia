import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api-client';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutocompleteInputProps {
  type: 'skill' | 'job_title' | 'keyword';
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  minLength?: number;
  className?: string;
  // Full profile context for dynamic adaptation
  profileContext?: {
    skills?: string[];
    jobTitles?: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
    locations?: Array<{ display_name: string; country?: string; city?: string; location_type?: string }>;
  };
}

export function AutocompleteInput({
  type,
  value,
  onChange,
  placeholder,
  maxItems = 50,
  minLength = 2,
  className,
  profileContext = {},
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce input for performance (300ms delay)
  const debouncedInput = useDebouncedValue(inputValue, 300);

  // Build context key for cache invalidation when context changes
  const contextKey = useMemo(() => {
    return JSON.stringify({
      skills: profileContext.skills || [],
      jobTitles: profileContext.jobTitles || [],
      includeKeywords: profileContext.includeKeywords || [],
      excludeKeywords: profileContext.excludeKeywords || [],
      locations: profileContext.locations || [],
    });
  }, [
    profileContext.skills,
    profileContext.jobTitles,
    profileContext.includeKeywords,
    profileContext.excludeKeywords,
    profileContext.locations,
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ['apply-suggestions', type, debouncedInput, value.join(','), contextKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        q: debouncedInput,
        limit: '20',
      });
      
      // Pass full profile context
      if (profileContext.skills && profileContext.skills.length > 0) {
        params.append('skills', profileContext.skills.join(','));
      }
      if (profileContext.jobTitles && profileContext.jobTitles.length > 0) {
        params.append('jobTitles', profileContext.jobTitles.join(','));
      }
      if (profileContext.includeKeywords && profileContext.includeKeywords.length > 0) {
        params.append('includeKeywords', profileContext.includeKeywords.join(','));
      }
      if (profileContext.excludeKeywords && profileContext.excludeKeywords.length > 0) {
        params.append('excludeKeywords', profileContext.excludeKeywords.join(','));
      }
      if (profileContext.locations && profileContext.locations.length > 0) {
        params.append('locations', JSON.stringify(profileContext.locations));
      }
      
      return apiClient.get(`/api/apply/suggestions?${params.toString()}`);
    },
    enabled: isOpen && (debouncedInput.length >= minLength || debouncedInput.length === 0),
    staleTime: 5000, // 5 second cache for faster adaptation
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once on failure
  });

  const response = (data as any) || {};
  const matches = response.matches || [];
  const recommended = response.recommended || [];
  const suggestions = response.suggestions || matches; // Fallback for backward compatibility

  // Filter out already selected items
  const filteredMatches = matches.filter(
    (s: any) => !value.some(v => v.toLowerCase() === s.value.toLowerCase())
  );
  const filteredRecommended = recommended.filter(
    (s: any) => !value.some(v => v.toLowerCase() === s.value.toLowerCase())
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

  const addItem = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;

    // Check for duplicates (case-insensitive)
    if (value.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    // Check max items
    if (value.length >= maxItems) {
      return;
    }

    onChange([...value, trimmed]);
    setInputValue('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const allFilteredSuggestions = [...filteredRecommended, ...filteredMatches];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && allFilteredSuggestions[highlightedIndex]) {
        addItem(allFilteredSuggestions[highlightedIndex].value);
      } else if (inputValue.trim()) {
        addItem(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev < allFilteredSuggestions.length - 1 ? prev + 1 : prev
      );
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
    <div className={cn('relative', className)}>
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1 bg-tm-primary-from/20 text-tm-text rounded-full text-sm"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="hover:text-red-500 transition-colors"
                aria-label={`Remove ${item}`}
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
          onFocus={() => {
            setIsOpen(true);
            // Show recommendations immediately on focus
            if (inputValue.length === 0 && (filteredRecommended.length > 0 || filteredMatches.length > 0)) {
              // Already have data, just open
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || `Add ${type.replace('_', ' ')}...`}
          className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
          disabled={value.length >= maxItems}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-tm-text-muted" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (debouncedInput.length >= minLength || debouncedInput.length === 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-tm-card border border-tm-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {/* Recommended Section */}
          {filteredRecommended.length > 0 && value.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-tm-text-muted uppercase tracking-wide">
                Recommended for you
              </div>
              <ul>
                {filteredRecommended.map((suggestion: any, index: number) => {
                  const globalIndex = index;
                  return (
                    <li
                      key={`rec-${index}`}
                      onClick={() => addItem(suggestion.value)}
                      onMouseEnter={() => setHighlightedIndex(globalIndex)}
                      className={cn(
                        'px-4 py-2 cursor-pointer transition-colors',
                        highlightedIndex === globalIndex
                          ? 'bg-tm-primary-from/20 text-tm-primary-from'
                          : 'hover:bg-tm-bg/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{suggestion.value}</span>
                        <span className="text-xs text-tm-primary-from">Recommended</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Matches Section */}
          {filteredMatches.length > 0 ? (
            <div className={filteredRecommended.length > 0 ? 'border-t border-tm-border' : ''}>
              {filteredRecommended.length > 0 && (
                <div className="px-4 py-1 text-xs font-semibold text-tm-text-muted uppercase tracking-wide">
                  Matches
                </div>
              )}
              <ul className="py-1">
                {filteredMatches.map((suggestion: any, index: number) => {
                  const globalIndex = filteredRecommended.length + index;
                  return (
                    <li
                      key={`match-${index}`}
                      onClick={() => addItem(suggestion.value)}
                      onMouseEnter={() => setHighlightedIndex(globalIndex)}
                      className={cn(
                        'px-4 py-2 cursor-pointer transition-colors',
                        highlightedIndex === globalIndex
                          ? 'bg-tm-primary-from/20 text-tm-primary-from'
                          : 'hover:bg-tm-bg/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{suggestion.value}</span>
                        <div className="flex items-center gap-2">
                          {suggestion.is_user_history && (
                            <span className="text-xs text-tm-text-muted">Your history</span>
                          )}
                          {suggestion.category && (
                            <span className="text-xs text-tm-text-muted">{suggestion.category}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : debouncedInput.length >= minLength ? (
            <div className="px-4 py-2 text-sm text-tm-text-muted">
              No suggestions found. Press Enter to add "{debouncedInput}"
            </div>
          ) : debouncedInput.length === 0 && filteredRecommended.length === 0 && filteredMatches.length === 0 ? (
            <div className="px-4 py-2 text-sm text-tm-text-muted">
              Start typing to search...
            </div>
          ) : null}
        </div>
      )}

      {/* Helper text */}
      {value.length >= maxItems && (
        <p className="mt-1 text-xs text-yellow-500">
          Maximum {maxItems} items reached
        </p>
      )}
    </div>
  );
}

