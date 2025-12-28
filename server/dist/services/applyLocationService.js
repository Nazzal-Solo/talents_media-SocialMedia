"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyLocationService = void 0;
const middlewares_1 = require("../middlewares");
let fetch;
class ApplyLocationService {
    constructor() {
        this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
        this.cache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000;
        this.lastRequestTime = 0;
    }
    async getFetch() {
        if (!fetch) {
            const nodeFetch = await Promise.resolve().then(() => __importStar(require('node-fetch')));
            fetch = nodeFetch.default;
        }
        return fetch;
    }
    async searchLocations(query, limit = 10) {
        if (!query || query.trim().length < 2) {
            return [];
        }
        const queryKey = `search:${query.toLowerCase()}:${limit}`;
        const cached = this.cache.get(queryKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        try {
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
                    'User-Agent': 'TalentsMedia/1.0 (Contact: support@talentsmedia.com)',
                    'Accept-Language': 'en',
                },
            });
            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.status}`);
            }
            const data = (await response.json());
            const results = data.map((item) => {
                const address = item.address || {};
                return {
                    display_name: item.display_name,
                    country: address.country || address.country_code,
                    city: address.city || address.town || address.village || address.municipality,
                    region: address.state || address.region || address.province,
                    latitude: parseFloat(item.lat),
                    longitude: parseFloat(item.lon),
                    place_id: item.place_id,
                };
            });
            this.cache.set(queryKey, { data: results, timestamp: Date.now() });
            if (this.cache.size > 100) {
                const entries = Array.from(this.cache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toDelete = entries.slice(0, entries.length - 100);
                toDelete.forEach(([key]) => this.cache.delete(key));
            }
            return results;
        }
        catch (error) {
            middlewares_1.logger.error('Error searching locations:', error);
            return [];
        }
    }
    async reverseGeocode(lat, lon) {
        try {
            await this.rateLimit();
            const fetchFn = await this.getFetch();
            const url = new URL(`${this.nominatimBaseUrl}/reverse`);
            url.searchParams.set('lat', String(lat));
            url.searchParams.set('lon', String(lon));
            url.searchParams.set('format', 'json');
            url.searchParams.set('addressdetails', '1');
            middlewares_1.logger.info(`Reverse geocoding: lat=${lat}, lon=${lon}`);
            const response = await fetchFn(url.toString(), {
                headers: {
                    'User-Agent': 'TalentsMedia/1.0 (Contact: support@talentsmedia.com)',
                    'Accept-Language': 'en',
                },
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                middlewares_1.logger.error(`Nominatim API error: ${response.status} - ${errorText}`);
                throw new Error(`Nominatim API error: ${response.status}`);
            }
            const item = await response.json();
            if (!item || !item.display_name) {
                middlewares_1.logger.warn('Nominatim returned empty result');
                return null;
            }
            const address = item.address || {};
            const result = {
                display_name: item.display_name,
                country: address.country || address.country_code,
                city: address.city || address.town || address.village || address.municipality,
                region: address.state || address.region || address.province,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                place_id: item.place_id,
            };
            middlewares_1.logger.info(`Reverse geocode success: ${result.display_name}`);
            return result;
        }
        catch (error) {
            middlewares_1.logger.error('Error reverse geocoding:', error?.message || error);
            return null;
        }
    }
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }
}
exports.ApplyLocationService = ApplyLocationService;
//# sourceMappingURL=applyLocationService.js.map