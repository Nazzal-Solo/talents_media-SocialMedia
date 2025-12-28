import { BaseProvider, ProviderQuery, ApplyJob } from './baseProvider';
import { logger } from '../../middlewares';

/**
 * Findwork API Provider
 * Fetches real jobs from Findwork.dev API (free, no API key required)
 * API Docs: https://findwork.dev/developers/
 */
export class FindworkProvider extends BaseProvider {
  private apiBaseUrl = 'https://findwork.dev/api/jobs';

  constructor() {
    super({
      name: 'findwork',
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
      logger.info('Findwork provider: Fetching real jobs from API');

      // Build search parameters
      const params = new URLSearchParams();
      
      // Add search query - Findwork uses 'search' parameter
      const searchTerms: string[] = [];
      if (query.jobTitles && query.jobTitles.length > 0) {
        // Use first job title or combine them
        searchTerms.push(query.jobTitles[0] || 'software developer');
      }
      if (query.keywords && query.keywords.length > 0 && searchTerms.length === 0) {
        searchTerms.push(query.keywords[0] || 'software developer');
      }
      
      if (searchTerms.length > 0) {
        params.append('search', searchTerms[0]); // Use first term for better results
      } else {
        params.append('search', 'software developer');
      }

      // Add location/remote filter - Findwork uses 'location' parameter
      if (query.remote) {
        params.append('location', 'Remote');
      } else if (query.location) {
        params.append('location', query.location);
      }

      // Limit results
      params.append('limit', String(Math.min(query.limit || 50, 50)));

      const apiUrl = `${this.apiBaseUrl}?${params.toString()}`;
      logger.info(`Findwork provider: Fetching from ${apiUrl}`);

      // Check if API key is configured
      const apiKey = process.env.FINDWORK_API_KEY;
      if (!apiKey) {
        logger.warn('Findwork API key not configured. Set FINDWORK_API_KEY in .env file. Skipping Findwork provider.');
        return [];
      }

      // Handle API key format (with or without "Token " prefix)
      const authToken = apiKey.startsWith('Token ') ? apiKey : `Token ${apiKey}`;

      const response = await this.safeFetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': authToken,
        },
      });

      if (!response.ok) {
        logger.error(`Findwork API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const jobs: ApplyJob[] = [];

      logger.info(`Findwork API response status: ${response.status}, data keys:`, Object.keys(data || {}));
      logger.info(`Findwork API response sample:`, JSON.stringify(data).substring(0, 500));

      // Findwork API returns results in 'results' array or directly as array
      let results: any[] = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data.results && Array.isArray(data.results)) {
        results = data.results;
      } else if (data.count > 0 && data.results) {
        results = data.results;
      } else if (data && typeof data === 'object') {
        // Try to find results in nested structure
        const keys = Object.keys(data);
        for (const key of keys) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            results = data[key];
            break;
          }
        }
      }

      logger.info(`Findwork provider: Found ${results.length} results in API response`);
      if (results.length > 0) {
        logger.info(`Findwork provider: First result sample:`, JSON.stringify(results[0]).substring(0, 300));
      }

      for (const item of results) {
        try {
          const job = this.normalizeJob(item);
          if (job) {
            jobs.push(job);
          }
        } catch (error: any) {
          logger.warn(`Error normalizing Findwork job:`, error.message);
        }
      }

      logger.info(`Findwork provider: Fetched ${jobs.length} real jobs`);
      return jobs;
    } catch (error: any) {
      logger.error('Findwork provider error:', error.message || error);
      return [];
    }
  }

  protected normalizeJob(rawJob: any): ApplyJob | null {
    try {
      // Findwork API might use different field names - check common variations
      const title = rawJob.title || rawJob.role || rawJob.job_title || rawJob.name || rawJob.position;
      const url = rawJob.url || rawJob.link || rawJob.redirect_url || rawJob.apply_url || rawJob.job_url;
      const company = rawJob.company_name || rawJob.company?.name || rawJob.company || rawJob.employer || rawJob.organization;
      const location = rawJob.location || rawJob.location_name || rawJob.city || rawJob.place;
      const description = rawJob.description || rawJob.summary || rawJob.details || rawJob.content || '';
      const externalId = rawJob.id?.toString() || rawJob.job_id?.toString() || url?.split('/').pop() || null;

      if (!title || !url) {
        logger.warn(`Findwork job missing required fields - title: ${!!title}, url: ${!!url}`, {
          rawJobKeys: Object.keys(rawJob || {}),
        });
        return null;
      }

      const jobHash = this.generateJobHash({
        source: 'findwork',
        external_id: externalId,
        title: title,
        company: company,
        job_url: url,
      });

      const normalizedJob: ApplyJob = {
        id: '', // Will be set when saved
        external_id: externalId,
        source: 'findwork',
        title: String(title).trim(),
        company: company ? String(company) : undefined,
        location: location ? String(location) : undefined,
        description: description ? String(description).substring(0, 5000) : '',
        salary_min: rawJob.salary_min ? Number(rawJob.salary_min) : undefined,
        salary_max: rawJob.salary_max ? Number(rawJob.salary_max) : undefined,
        salary_currency: rawJob.salary_currency || 'USD',
        job_url: url,
        application_url: url,
        application_method: this.extractApplyEmail(description) ? 'email' : 'url',
        apply_email: this.extractApplyEmail(description) || undefined,
        is_remote: this.isRemoteJob(location, description),
        posted_date: rawJob.date_posted ? new Date(rawJob.date_posted) : (rawJob.created ? new Date(rawJob.created) : new Date()),
        job_hash: jobHash,
        raw_data: {
          id: rawJob.id,
          source: rawJob.source,
          date_posted: rawJob.date_posted,
          original: rawJob, // Keep full original for debugging
        },
      } as any;

      return normalizedJob;
    } catch (error: any) {
      logger.error(`Error normalizing Findwork job:`, error.message, {
        rawJobKeys: Object.keys(rawJob || {}),
      });
      return null;
    }
  }
}

