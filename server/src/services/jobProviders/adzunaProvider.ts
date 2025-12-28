import { BaseProvider, ProviderQuery, ApplyJob } from './baseProvider';
import { logger } from '../../middlewares';

/**
 * Adzuna API Provider
 * Fetches real jobs from Adzuna API (free tier available)
 * API Docs: https://developer.adzuna.com/
 * Note: Requires API key and app ID (free to get)
 */
export class AdzunaProvider extends BaseProvider {
  private apiBaseUrl = 'https://api.adzuna.com/v1/api/jobs';

  constructor() {
    super({
      name: 'adzuna',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
    });
  }

  async fetchJobs(query: ProviderQuery): Promise<ApplyJob[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      // Check if API credentials are configured
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;
      
      if (!appId || !appKey) {
        logger.warn('Adzuna API credentials not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env file. Skipping Adzuna provider.');
        return [];
      }

      logger.info('Adzuna provider: Fetching real jobs from API');

      // Build search parameters
      const params = new URLSearchParams();
      params.append('app_id', appId);
      params.append('app_key', appKey);
      
      // Add search query - use first job title or first keyword for better results
      let searchQuery = 'software developer'; // default
      if (query.jobTitles && query.jobTitles.length > 0) {
        searchQuery = query.jobTitles[0]; // Use first job title
      } else if (query.keywords && query.keywords.length > 0) {
        searchQuery = query.keywords[0]; // Use first keyword
      }
      
      params.append('what', searchQuery);
      logger.info(`Adzuna provider: Search query: "${searchQuery}"`);

      // Add location/remote filter
      // For remote jobs, don't add location filter - search globally
      if (!query.remote && query.location) {
        params.append('where', query.location);
      }
      // If remote or no location, search without location filter for better results

      // Limit results
      params.append('results_per_page', String(Math.min(query.limit || 50, 50)));
      params.append('sort_by', 'date');
      params.append('content-type', 'application/json');

      // Use 'us' country code (change to your target country)
      // Available: us, gb, au, ca, de, at, be, ch, es, fr, ie, it, mx, nl, nz, pl, ru, za
      const countryCode = 'us'; // Change this based on your target market
      const apiUrl = `${this.apiBaseUrl}/${countryCode}/search/1?${params.toString()}`;
      logger.info(`Adzuna provider: Fetching from API (country: ${countryCode})`);

      const response = await this.safeFetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.error(`Adzuna API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const jobs: ApplyJob[] = [];

      logger.info(`Adzuna API response status: ${response.status}, count: ${data.count || 0}`);

      // Adzuna API returns results in 'results' array
      const results = data.results || [];
      
      logger.info(`Adzuna provider: Found ${results.length} results in API response`);

      for (const item of results) {
        try {
          const job = this.normalizeJob(item);
          if (job) {
            jobs.push(job);
          }
        } catch (error: any) {
          logger.warn(`Error normalizing Adzuna job:`, error.message);
        }
      }

      logger.info(`Adzuna provider: Fetched ${jobs.length} real jobs`);
      return jobs;
    } catch (error: any) {
      logger.error('Adzuna provider error:', error.message || error);
      return [];
    }
  }

  protected normalizeJob(rawJob: any): ApplyJob | null {
    if (!rawJob.title || !rawJob.redirect_url) {
      return null;
    }

    const jobHash = this.generateJobHash({
      source: 'adzuna',
      external_id: rawJob.id?.toString() || rawJob.redirect_url,
      title: rawJob.title,
      company: rawJob.company?.display_name,
      job_url: rawJob.redirect_url,
    });

    return {
      id: '', // Will be set when saved
      external_id: rawJob.id?.toString() || rawJob.redirect_url?.split('/').pop() || null,
      source: 'adzuna',
      title: rawJob.title.trim(),
      company: rawJob.company?.display_name || undefined,
      location: rawJob.location?.display_name || undefined,
      description: rawJob.description || rawJob.summary || '',
      salary_min: rawJob.salary_min ? Math.round(rawJob.salary_min) : undefined,
      salary_max: rawJob.salary_max ? Math.round(rawJob.salary_max) : undefined,
      salary_currency: rawJob.salary_currency || 'USD',
      job_url: rawJob.redirect_url,
      application_url: rawJob.redirect_url,
      application_method: this.extractApplyEmail(rawJob.description || '') ? 'email' : 'url',
      apply_email: this.extractApplyEmail(rawJob.description || '') || undefined,
      is_remote: this.isRemoteJob(rawJob.location?.display_name, rawJob.description),
      posted_date: rawJob.created ? new Date(rawJob.created) : new Date(),
      job_hash: jobHash,
      raw_data: {
        id: rawJob.id,
        category: rawJob.category,
        created: rawJob.created,
      },
    } as any;
  }
}

