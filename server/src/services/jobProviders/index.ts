import { BaseProvider, ProviderQuery } from './baseProvider';
import { RSSProvider } from './rssProvider';
import { GitHubJobsProvider } from './githubJobsProvider';
import { DemoProvider } from './demoProvider';
import { FindworkProvider } from './findworkProvider';
import { AdzunaProvider } from './adzunaProvider';
import { ApplyJob } from '../applyService';
import { logger } from '../../middlewares';

/**
 * Provider Registry
 * Manages all job providers
 */
export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    // Register providers (order matters - first one tried first)
    // Adzuna API - Real jobs, free tier available (requires API key)
    this.register(new AdzunaProvider());
    // Findwork API - Real jobs (requires API key)
    this.register(new FindworkProvider());
    // RSS Provider - Tries public RSS feeds (may not work)
    this.register(new RSSProvider());
    // Demo provider - Only used as last resort fallback for testing
    // this.register(new DemoProvider()); // Disabled - use real jobs instead
    // GitHub Jobs is disabled, but kept for reference
    // this.register(new GitHubJobsProvider());
  }

  /**
   * Register a provider
   */
  register(provider: BaseProvider): void {
    this.providers.set(provider.getName(), provider);
    logger.info(`Registered job provider: ${provider.getName()}`);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): BaseProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isEnabled());
  }

  /**
   * Fetch jobs from all enabled providers
   */
  async fetchJobsFromAll(query: ProviderQuery): Promise<ApplyJob[]> {
    const providers = this.getEnabledProviders();
    const allJobs: ApplyJob[] = [];

    for (const provider of providers) {
      try {
        logger.info(`Fetching jobs from provider: ${provider.getName()}`);
        const jobs = await provider.fetchJobs(query);
        logger.info(`Fetched ${jobs.length} jobs from ${provider.getName()}`);
        allJobs.push(...jobs);

        // Rate limiting: small delay between providers
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        logger.error(`Error fetching from provider ${provider.getName()}:`, error);
        // Continue with other providers
      }
    }

    return allJobs;
  }

  /**
   * Fetch jobs from a specific provider
   */
  async fetchJobsFromProvider(providerName: string, query: ProviderQuery): Promise<ApplyJob[]> {
    const provider = this.getProvider(providerName);
    if (!provider || !provider.isEnabled()) {
      logger.warn(`Provider ${providerName} not found or disabled`);
      return [];
    }

    try {
      return await provider.fetchJobs(query);
    } catch (error: any) {
      logger.error(`Error fetching from provider ${providerName}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();

