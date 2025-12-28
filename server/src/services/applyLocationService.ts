import { logger } from '../middlewares';

export interface LocationResult {
  display_name: string;
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  place_id?: number;
}

export class ApplyLocationService {
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private cache = new Map<
    string,
    { data: LocationResult[]; timestamp: number }
  >();
  private cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get fetch function - use built-in fetch if available (Node 18+), otherwise use node-fetch
   */
  private async getFetch(): Promise<typeof fetch> {
    // Check if global fetch is available (Node.js 18+)
    if (typeof globalThis.fetch === 'function') {
      return globalThis.fetch;
    }

    // Fallback to node-fetch for older Node versions
    try {
      const nodeFetch = await import('node-fetch');
      return nodeFetch.default as typeof fetch;
    } catch (error: any) {
      logger.error('Failed to import node-fetch:', {
        message: error?.message,
        stack: error?.stack,
      });
      throw new Error(
        'Failed to load fetch module. Please ensure node-fetch is installed or use Node.js 18+.'
      );
    }
  }

  /**
   * Search for locations using Nominatim API
   * Respects rate limits (1 request per second)
   */
  async searchLocations(
    query: string,
    limit: number = 10
  ): Promise<LocationResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const queryKey = `search:${query.toLowerCase()}:${limit}`;

    // Check cache
    const cached = this.cache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Rate limit: wait 1 second between requests
      await this.rateLimit();

      const fetchFn = await this.getFetch();
      const url = new URL(`${this.nominatimBaseUrl}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      url.searchParams.set('namedetails', '1');

      const response = await fetchFn(url.toString(), {
        headers: {
          'User-Agent': 'TalentsMedia/1.0 (Contact: support@talentsmedia.com)', // Required by Nominatim
          'Accept-Language': 'en',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = (await response.json()) as any[];

      const results: LocationResult[] = data.map((item: any) => {
        const address = item.address || {};

        // Extract city and country
        const city =
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.state_district ||
          '';
        const country = address.country || address.country_code || '';

        // Format display_name as "City, Country" (only if both exist)
        let display_name = item.display_name; // fallback to full name
        if (city && country) {
          display_name = `${city}, ${country}`;
        } else if (city) {
          display_name = city;
        } else if (country) {
          display_name = country;
        }

        return {
          display_name,
          country,
          city,
          region: address.state || address.region || address.province,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          place_id: item.place_id,
        };
      });

      // Cache results
      this.cache.set(queryKey, { data: results, timestamp: Date.now() });

      // Clean old cache entries (keep max 100 entries)
      if (this.cache.size > 100) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, entries.length - 100);
        toDelete.forEach(([key]) => this.cache.delete(key));
      }

      return results;
    } catch (error) {
      logger.error('Error searching locations:', error);
      return [];
    }
  }

  /**
   * Reverse geocode: get location from coordinates
   */
  async reverseGeocode(
    lat: number,
    lon: number
  ): Promise<LocationResult | null> {
    try {
      await this.rateLimit();

      const fetchFn = await this.getFetch();
      const url = new URL(`${this.nominatimBaseUrl}/reverse`);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');

      logger.info(`Reverse geocoding: lat=${lat}, lon=${lon}`, {
        url: url.toString(),
      });

      const response = await fetchFn(url.toString(), {
        headers: {
          'User-Agent': 'TalentsMedia/1.0 (Contact: support@talentsmedia.com)',
          'Accept-Language': 'en',
        },
      }).catch((fetchError: any) => {
        logger.error('Fetch error in reverse geocode:', {
          message: fetchError?.message,
          name: fetchError?.name,
          code: fetchError?.code,
        });
        throw fetchError;
      });

      logger.info(
        `Nominatim response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error(`Nominatim API error: ${response.status} - ${errorText}`, {
          url: url.toString(),
          lat,
          lon,
        });
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const item: any = await response.json().catch((jsonError: any) => {
        logger.error('JSON parse error in reverse geocode:', {
          message: jsonError?.message,
          name: jsonError?.name,
        });
        throw jsonError;
      });

      logger.info('Nominatim response:', {
        hasItem: !!item,
        hasDisplayName: !!item?.display_name,
        itemKeys: item ? Object.keys(item) : [],
      });

      if (!item || !item.display_name) {
        logger.warn('Nominatim returned empty result', { item });
        return null;
      }

      const address = item.address || {};

      // Extract city and country
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.state_district ||
        '';
      const country = address.country || address.country_code || '';

      // Format display_name as "City, Country" (only if both exist)
      let display_name = item.display_name; // fallback to full name
      if (city && country) {
        display_name = `${city}, ${country}`;
      } else if (city) {
        display_name = city;
      } else if (country) {
        display_name = country;
      }

      const result = {
        display_name,
        country,
        city,
        region: address.state || address.region || address.province,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        place_id: item.place_id,
      };

      logger.info(`Reverse geocode success: ${result.display_name}`);
      return result;
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || String(error),
        name: error?.name,
        stack: error?.stack,
        lat,
        lon,
        url: `${this.nominatimBaseUrl}/reverse?lat=${lat}&lon=${lon}`,
        errorType: error?.constructor?.name,
      };
      logger.error('Error reverse geocoding:', errorDetails);
      console.error('[DEBUG] Reverse geocode error details:', errorDetails);
      return null;
    }
  }

  /**
   * Rate limiting: ensure 1 request per second
   */
  private lastRequestTime = 0;
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve =>
        setTimeout(resolve, 1000 - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }
}
