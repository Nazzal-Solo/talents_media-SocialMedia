export interface LocationResult {
    display_name: string;
    country?: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    place_id?: number;
}
export declare class ApplyLocationService {
    private nominatimBaseUrl;
    private cache;
    private cacheTimeout;
    private getFetch;
    searchLocations(query: string, limit?: number): Promise<LocationResult[]>;
    reverseGeocode(lat: number, lon: number): Promise<LocationResult | null>;
    private lastRequestTime;
    private rateLimit;
}
//# sourceMappingURL=applyLocationService.d.ts.map