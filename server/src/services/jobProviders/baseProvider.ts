import { ApplyJob } from '../applyService';
import { logger } from '../../middlewares';

export interface ProviderQuery {
  jobTitles?: string[];
  keywords?: string[];
  location?: string;
  remote?: boolean;
  limit?: number;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Fetch jobs from this provider based on query
   */
  abstract fetchJobs(query: ProviderQuery): Promise<ApplyJob[]>;

  /**
   * Normalize a job from provider-specific format to ApplyJob
   */
  protected abstract normalizeJob(rawJob: any): ApplyJob;

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Generate a hash for deduplication
   */
  protected generateJobHash(job: Partial<ApplyJob>): string {
    const crypto = require('crypto');
    const hashInput = `${job.source || ''}_${job.external_id || ''}_${job.title || ''}_${job.company || ''}_${job.job_url || ''}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 64);
  }

  /**
   * Extract apply email from job description or URL
   * Only extracts official emails (careers@, jobs@, hr@, apply@)
   */
  protected extractApplyEmail(description: string, url?: string): string | null {
    if (!description) return null;

    // Look for official apply emails in description
    const emailPattern = /\b(careers|jobs|hr|apply|recruiting|recruitment)@[\w.-]+\.[a-z]{2,}\b/gi;
    const matches = description.match(emailPattern);
    
    if (matches && matches.length > 0) {
      // Return first valid email, normalized to lowercase
      return matches[0].toLowerCase().trim();
    }

    return null;
  }

  /**
   * Check if job is remote based on description or location
   */
  protected isRemoteJob(location?: string, description?: string): boolean {
    if (!location && !description) return false;

    const remoteKeywords = ['remote', 'work from home', 'wfh', 'distributed', 'anywhere', 'global'];
    const text = `${location || ''} ${description || ''}`.toLowerCase();

    return remoteKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Safe fetch with timeout and error handling
   */
  protected async safeFetch(url: string, options?: RequestInit, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }
}

