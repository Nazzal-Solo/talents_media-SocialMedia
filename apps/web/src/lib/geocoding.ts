export interface LocationData {
  city?: string;
  country?: string;
  displayName: string;
}

/**
 * Reverse geocode coordinates to get city and country
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<LocationData | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SocialMediaPlatform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();

    if (!data || !data.address) {
      return null;
    }

    const address = data.address;
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      '';
    const country = address.country || '';

    // Format display name
    let displayName = '';
    if (city && country) {
      displayName = `${city}, ${country}`;
    } else if (city) {
      displayName = city;
    } else if (country) {
      displayName = country;
    } else {
      displayName = data.display_name?.split(',')[0] || '';
    }

    return {
      city: city || undefined,
      country: country || undefined,
      displayName,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Search for locations by name (geocoding)
 * Uses OpenStreetMap Nominatim API for autocomplete
 */
export async function searchLocations(
  query: string,
  limit: number = 5
): Promise<LocationData[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=${limit}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SocialMediaPlatform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Location search failed');
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => {
      const address = item.address || {};
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        '';
      const country = address.country || '';

      let displayName = '';
      if (city && country) {
        displayName = `${city}, ${country}`;
      } else if (city) {
        displayName = city;
      } else if (country) {
        displayName = country;
      } else {
        displayName =
          item.display_name?.split(',')[0] || item.display_name || '';
      }

      return {
        city: city || undefined,
        country: country || undefined,
        displayName,
      };
    });
  } catch (error) {
    console.error('Location search error:', error);
    return [];
  }
}

