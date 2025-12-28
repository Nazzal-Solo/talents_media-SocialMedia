/**
 * Location Suggestion Service
 *
 * Provides fast, typo-tolerant location suggestions using PostgreSQL
 * with fuzzy matching and context-aware ranking.
 */

import { query } from '../models/db';
import { logger } from '../middlewares';
import { ProfileContext } from './profileContextBuilder';
import { fuzzyMatch, normalizeText } from './fuzzyMatcher';

export interface LocationCandidate {
  id: string;
  displayName: string;
  normalizedKey: string;
  type: 'country' | 'city';
  countryId?: string;
  countryName?: string;
  cityName?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  aliases: string[];
  popularityScore: number;
}

export interface RankedLocationSuggestion {
  value: string;
  displayName: string;
  type: 'country' | 'city' | 'remote';
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  score: number;
  matchScore: number;
  contextScore: number;
  popularityScore: number;
  isRecommended?: boolean;
}

export class LocationSuggestionService {
  private static instance: LocationSuggestionService;
  private cache = new Map<
    string,
    { results: RankedLocationSuggestion[]; timestamp: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private allCountries: LocationCandidate[] = [];
  private allCities: LocationCandidate[] = [];
  private countriesLoaded = false;
  private citiesLoaded = false;

  private constructor() {
    // Load countries and cities on startup (async, non-blocking)
    this.loadCountries().catch(err => {
      logger.error('Failed to load countries:', err);
    });
    this.loadCities().catch(err => {
      logger.error('Failed to load cities:', err);
    });
    // Clean cache periodically
    setInterval(() => this.cleanupCache(), 60 * 1000);
  }

  public static getInstance(): LocationSuggestionService {
    if (!LocationSuggestionService.instance) {
      LocationSuggestionService.instance = new LocationSuggestionService();
    }
    return LocationSuggestionService.instance;
  }

  /**
   * Load all countries into memory for fast access
   */
  private async loadCountries(): Promise<void> {
    try {
      const result = await query<{
        id: string;
        name: string;
        iso2: string | null;
        iso3: string | null;
        aliases: string[];
        normalized_key: string;
      }>(
        `SELECT id, name, iso2, iso3, aliases, normalized_key 
         FROM apply_countries 
         ORDER BY name`
      );

      this.allCountries = result.rows.map(row => ({
        id: row.id,
        displayName: row.name,
        normalizedKey: row.normalized_key,
        type: 'country' as const,
        aliases: row.aliases || [],
        popularityScore: this.calculateCountryPopularity(row.name, row.iso2),
      }));

      this.countriesLoaded = true;
      logger.info(
        `✅ Loaded ${this.allCountries.length} countries into memory`
      );
      
      // Log sample countries for debugging
      if (this.allCountries.length > 0) {
        logger.debug(`Sample countries: ${this.allCountries.slice(0, 5).map(c => c.displayName).join(', ')}`);
      }
    } catch (error) {
      logger.error('Error loading countries:', error);
      this.countriesLoaded = true; // Mark as loaded even on error to prevent retries
    }
  }

  /**
   * Load all cities into memory for fast access
   * Only loads major cities (population > 100k or capital cities)
   */
  private async loadCities(): Promise<void> {
    try {
      const result = await query<{
        id: string;
        name: string;
        country_id: string;
        country_name: string;
        admin_region: string | null;
        population: number | null;
        latitude: number | null;
        longitude: number | null;
        aliases: string[];
        normalized_key: string;
      }>(
        `SELECT 
          c.id, 
          c.name, 
          c.country_id,
          co.name as country_name,
          c.admin_region,
          c.population,
          c.latitude,
          c.longitude,
          c.aliases,
          c.normalized_key
         FROM apply_cities c
         JOIN apply_countries co ON c.country_id = co.id
         WHERE c.population > 100000 OR c.population IS NULL
         ORDER BY c.population DESC NULLS LAST, c.name
         LIMIT 10000`
      );

      this.allCities = result.rows.map(row => ({
        id: row.id,
        displayName: `${row.name}, ${row.country_name}`,
        normalizedKey: row.normalized_key,
        type: 'city' as const,
        countryId: row.country_id,
        countryName: row.country_name,
        cityName: row.name,
        region: row.admin_region || undefined,
        latitude: row.latitude ? parseFloat(String(row.latitude)) : undefined,
        longitude: row.longitude
          ? parseFloat(String(row.longitude))
          : undefined,
        population: row.population || undefined,
        aliases: row.aliases || [],
        popularityScore: this.calculateCityPopularity(row.population),
      }));

      this.citiesLoaded = true;
      logger.info(`✅ Loaded ${this.allCities.length} cities into memory`);
      
      // Log sample cities for debugging
      if (this.allCities.length > 0) {
        logger.debug(`Sample cities: ${this.allCities.slice(0, 5).map(c => c.displayName).join(', ')}`);
      }
    } catch (error) {
      logger.error('Error loading cities:', error);
      this.citiesLoaded = true; // Mark as loaded even on error
    }
  }

  /**
   * Get location suggestions with fuzzy matching and context-aware ranking
   */
  public async getSuggestions(
    queryText: string,
    context: ProfileContext,
    limit: number = 20
  ): Promise<RankedLocationSuggestion[]> {
    const startTime = Date.now();
    const queryLower = queryText.toLowerCase().trim();
    const queryNorm = normalizeText(queryText);
    
    logger.debug(`Location suggestions requested: query="${queryText}", countries=${this.allCountries.length}, cities=${this.allCities.length}`);

    // Check cache
    const cacheKey = `location:${queryNorm}:${JSON.stringify(context.locations)}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }

    // Wait for data to load if not ready (with retries)
    let retries = 0;
    const maxRetries = 50; // 5 seconds total (50 * 100ms)
    while ((!this.countriesLoaded || !this.citiesLoaded) && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!this.countriesLoaded || !this.citiesLoaded) {
      logger.error(
        `Location data not loaded after ${maxRetries} retries. Countries: ${this.countriesLoaded}, Cities: ${this.citiesLoaded}`
      );
      // Return at least remote option even if data isn't loaded
      if (queryLower.length === 0 || queryLower.includes('remote')) {
        return [
          {
            value: 'remote',
            displayName: 'Remote',
            type: 'remote' as const,
            score: 100,
            matchScore: 1,
            contextScore: 0,
            popularityScore: 10,
          },
        ];
      }
      return [];
    }

    // Get all candidates (countries + cities)
    const allCandidates: LocationCandidate[] = [
      ...this.allCountries,
      ...this.allCities,
    ];
    
    logger.debug(`Total candidates: ${allCandidates.length} (${this.allCountries.length} countries, ${this.allCities.length} cities)`);

    // Add remote option if query matches
    const remoteCandidates: LocationCandidate[] = [];
    if (
      queryLower.length === 0 ||
      ['remote', 'remot', 'global', 'anywhere', 'work from home'].some(term =>
        queryLower.includes(term)
      )
    ) {
      remoteCandidates.push({
        id: 'remote',
        displayName: 'Remote',
        normalizedKey: 'remote',
        type: 'country',
        aliases: ['work from home', 'wfh', 'anywhere', 'global remote'],
        popularityScore: 10,
      });
    }

    // Filter candidates by query
    let filteredCandidates: LocationCandidate[];
    if (queryText.length === 0) {
      // When query is empty, show popular countries and cities
      const popularCountries = this.allCountries
        .sort((a, b) => (b.popularityScore || 1) - (a.popularityScore || 1))
        .slice(0, 10);
      const popularCities = this.allCities
        .sort((a, b) => (b.popularityScore || 1) - (a.popularityScore || 1))
        .slice(0, 10);
      filteredCandidates = [...popularCountries, ...popularCities, ...remoteCandidates];
    } else {
      filteredCandidates = this.filterCandidates(
        [...this.allCountries, ...this.allCities, ...remoteCandidates],
        queryText
      );
    }
    
    logger.debug(`Filtered candidates: ${filteredCandidates.length} for query "${queryText}"`);

    // Rank candidates
    const ranked = filteredCandidates
      .map(candidate => this.rankCandidate(candidate, queryText, context))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache results
    this.cache.set(cacheKey, { results: ranked, timestamp: Date.now() });

    const duration = Date.now() - startTime;
    if (duration > 300) {
      logger.warn(
        `Slow location query: ${duration}ms for query "${queryText}"`
      );
    }

    return ranked;
  }

  /**
   * Filter candidates by query using fuzzy matching
   */
  private filterCandidates(
    candidates: LocationCandidate[],
    queryText: string
  ): LocationCandidate[] {
    const queryLower = queryText.toLowerCase();
    const results: Array<{ candidate: LocationCandidate; score: number }> = [];

    for (const candidate of candidates) {
      // Check display name
      const displayMatch = fuzzyMatch(queryText, candidate.displayName);
      if (displayMatch.score > 0.2) { // Lowered threshold from 0.3 to 0.2 for better matching
        results.push({ candidate, score: displayMatch.score });
        continue;
      }

      // Check aliases
      for (const alias of candidate.aliases) {
        const aliasMatch = fuzzyMatch(queryText, alias);
        if (aliasMatch.score > 0.2) { // Lowered threshold
          results.push({ candidate, score: aliasMatch.score });
          break;
        }
      }

      // Check normalized key (partial match)
      const queryNorm = normalizeText(queryText);
      if (candidate.normalizedKey.includes(queryNorm) || queryNorm.includes(candidate.normalizedKey)) {
        results.push({ candidate, score: 0.5 });
      }
      
      // Also check if query matches any word in the display name
      const displayWords = candidate.displayName.toLowerCase().split(/\s+/);
      for (const word of displayWords) {
        if (word.startsWith(queryLower) || queryLower.startsWith(word)) {
          results.push({ candidate, score: 0.4 });
          break;
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.candidate)
      .slice(0, 100); // Limit to top 100 for ranking
  }

  /**
   * Rank a single candidate
   */
  private rankCandidate(
    candidate: LocationCandidate,
    queryText: string,
    context: ProfileContext
  ): RankedLocationSuggestion {
    let totalScore = 0;
    let matchScore = 0;
    let contextScore = 0;
    let popularityScore = candidate.popularityScore || 1;

    // 1. Text match score (40%)
    const matchResult = fuzzyMatch(queryText, candidate.displayName);
    matchScore = matchResult.score;
    totalScore += matchScore * 400;

    // Check aliases for better match
    for (const alias of candidate.aliases) {
      const aliasMatch = fuzzyMatch(queryText, alias);
      if (aliasMatch.score > matchScore) {
        matchScore = aliasMatch.score;
        totalScore = matchScore * 400;
      }
    }

    // 2. Context relevance score (30%)
    contextScore = this.calculateContextScore(candidate, context);
    totalScore += contextScore * 300;

    // 3. Popularity score (30%)
    totalScore += popularityScore * 30;

    // Penalties
    // Penalize already-selected locations
    const selectedLocations = Array.from(context.locations.keys()).map(l =>
      normalizeText(l)
    );
    if (selectedLocations.includes(candidate.normalizedKey)) {
      totalScore = 0;
    }

    // Determine if recommended
    const isRecommended = matchScore < 0.5 && contextScore > 0.3;

    return {
      value: candidate.normalizedKey,
      displayName: candidate.displayName,
      type: candidate.normalizedKey === 'remote' ? 'remote' : candidate.type,
      country: candidate.countryName,
      city: candidate.cityName,
      region: candidate.region,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      score: totalScore,
      matchScore,
      contextScore,
      popularityScore,
      isRecommended,
    };
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextScore(
    candidate: LocationCandidate,
    context: ProfileContext
  ): number {
    let score = 0;

    // Boost if location is already in context
    const contextLocations = Array.from(context.locations.keys()).map(l =>
      normalizeText(l)
    );
    if (contextLocations.includes(candidate.normalizedKey)) {
      score += 0.5;
    }

    // Boost if candidate is a city in a country already selected
    if (candidate.type === 'city' && candidate.countryId) {
      const selectedCountries = contextLocations.filter(loc => {
        const country = this.allCountries.find(c => c.normalizedKey === loc);
        return country !== undefined;
      });
      if (selectedCountries.length > 0) {
        // Check if this city's country is selected
        const country = this.allCountries.find(
          c => c.id === candidate.countryId
        );
        if (country && contextLocations.includes(country.normalizedKey)) {
          score += 0.3;
        }
      }
    }

    // Boost remote if work arrangements suggest remote work
    if (candidate.normalizedKey === 'remote') {
      const remoteScore = context.workArrangements.get('remote') || 0;
      if (remoteScore > 0.5) {
        score += 0.4;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Calculate country popularity score
   */
  private calculateCountryPopularity(
    name: string,
    iso2: string | null
  ): number {
    // Major countries get higher scores
    const majorCountries = [
      'US',
      'GB',
      'CA',
      'AU',
      'DE',
      'FR',
      'IT',
      'ES',
      'NL',
      'BE',
      'CH',
      'AT',
      'SE',
      'NO',
      'DK',
      'FI',
      'IE',
      'NZ',
      'SG',
      'AE',
      'SA',
      'EG',
      'ZA',
      'IN',
      'CN',
      'JP',
      'KR',
      'BR',
      'MX',
      'AR',
    ];
    if (iso2 && majorCountries.includes(iso2.toUpperCase())) {
      return 10;
    }
    return 5;
  }

  /**
   * Calculate city popularity score based on population
   */
  private calculateCityPopularity(population: number | null): number {
    if (!population) return 5;
    if (population > 5000000) return 10;
    if (population > 1000000) return 8;
    if (population > 500000) return 6;
    return 4;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Normalize text (exposed for use by other services)
   */
  public normalizeText(text: string): string {
    return normalizeText(text);
  }
}
