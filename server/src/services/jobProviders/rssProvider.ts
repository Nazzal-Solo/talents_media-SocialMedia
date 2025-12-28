import { BaseProvider, ProviderQuery } from './baseProvider';
import { ApplyJob } from '../applyService';
import { logger } from '../../middlewares';
import Parser from 'rss-parser';

/**
 * RSS/Atom Feed Provider
 * Fetches jobs from RSS/Atom feeds (legal and safe)
 */
export class RSSProvider extends BaseProvider {
  private parser: Parser<any>;

  constructor() {
    super({
      name: 'rss',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
    });
    this.parser = new Parser({
      timeout: 10000,
      customFields: {
        item: ['description', 'content', 'location', 'company', 'salary'],
      },
    });
  }

  async fetchJobs(query: ProviderQuery): Promise<ApplyJob[]> {
    if (!this.isEnabled()) {
      logger.warn('RSS provider is disabled');
      return [];
    }

    try {
      logger.info(`RSS provider: Starting fetch with query:`, {
        jobTitles: query.jobTitles,
        keywords: query.keywords,
        remote: query.remote,
      });

      // For MVP, we'll use public RSS feeds for IT jobs
      // These are legal and don't violate ToS
      const feeds = this.generateFeedUrls(query);
      
      if (feeds.length === 0) {
        logger.warn('RSS provider: No feed URLs generated');
        return [];
      }

      logger.info(`RSS provider: Generated ${feeds.length} feed URLs`);
      const allJobs: ApplyJob[] = [];

      for (const feedUrl of feeds) {
        try {
          logger.info(`RSS provider: Attempting to fetch from: ${feedUrl}`);
          const jobs = await this.fetchFromFeed(feedUrl, query);
          logger.info(`RSS provider: Got ${jobs.length} jobs from ${feedUrl}`);
          allJobs.push(...jobs);
        } catch (error: any) {
          logger.error(`Error fetching from RSS feed ${feedUrl}:`, error.message || error);
          logger.error(`Error stack:`, error.stack);
          // Continue with other feeds
        }
      }

      logger.info(`RSS provider: Total jobs fetched: ${allJobs.length}`);
      return allJobs;
    } catch (error: any) {
      logger.error(`RSS provider error:`, error);
      logger.error(`Error stack:`, error.stack);
      return [];
    }
  }

  /**
   * Generate RSS feed URLs based on query
   * For MVP, we'll use public job board RSS feeds
   * Note: These URLs may need to be updated based on actual feed availability
   */
  private generateFeedUrls(query: ProviderQuery): string[] {
    const feeds: string[] = [];

    // Build search terms from query
    const searchTerms: string[] = [];
    if (query.jobTitles && query.jobTitles.length > 0) {
      searchTerms.push(...query.jobTitles);
    }
    if (query.keywords && query.keywords.length > 0) {
      searchTerms.push(...query.keywords);
    }
    
    // Default to IT/Tech jobs if no specific terms
    const searchQuery = searchTerms.length > 0 
      ? encodeURIComponent(searchTerms.join(' '))
      : encodeURIComponent('software developer engineer');

    // Try multiple RSS feed sources
    // Note: Many job boards have deprecated their RSS feeds
    // We'll try common patterns and fall back to demo jobs if none work
    
    // 1. Indeed RSS (may require specific format)
    try {
      const location = query.remote ? 'Remote' : '';
      const indeedUrl = `https://www.indeed.com/rss?q=${searchQuery}${location ? `&l=${encodeURIComponent(location)}` : ''}&radius=50&sort=date`;
      feeds.push(indeedUrl);
    } catch (e) {
      logger.warn('Error building Indeed RSS URL:', e);
    }

    // 2. Stack Overflow Jobs RSS
    try {
      if (query.keywords?.some(k => k.toLowerCase().includes('developer') || k.toLowerCase().includes('engineer') || k.toLowerCase().includes('software'))) {
        const soUrl = `https://stackoverflow.com/jobs/feed?q=${searchQuery}${query.remote ? '&r=true' : ''}`;
        feeds.push(soUrl);
      }
    } catch (e) {
      logger.warn('Error building Stack Overflow RSS URL:', e);
    }

    // 3. Remote.co RSS (for remote jobs)
    if (query.remote) {
      try {
        const remoteCoUrl = `https://remote.co/remote-jobs/rss/?search=${searchQuery}`;
        feeds.push(remoteCoUrl);
      } catch (e) {
        logger.warn('Error building Remote.co RSS URL:', e);
      }
    }

    // 4. FlexJobs RSS (if available)
    try {
      const flexJobsUrl = `https://www.flexjobs.com/rss?q=${searchQuery}`;
      feeds.push(flexJobsUrl);
    } catch (e) {
      logger.warn('Error building FlexJobs RSS URL:', e);
    }

    logger.info(`RSS provider: Generated ${feeds.length} feed URLs for query: ${searchQuery}`);
    
    // If no feeds generated, return empty (will trigger fallback)
    if (feeds.length === 0) {
      logger.warn('RSS provider: No feed URLs could be generated. This might indicate missing profile data.');
    }
    
    return feeds;
  }

  /**
   * Fetch jobs from a single RSS feed
   */
  private async fetchFromFeed(feedUrl: string, query: ProviderQuery): Promise<ApplyJob[]> {
    try {
      logger.info(`Fetching from RSS feed: ${feedUrl}`);
      const feed = await this.parser.parseURL(feedUrl);
      const jobs: ApplyJob[] = [];

      if (!feed.items || feed.items.length === 0) {
        logger.warn(`No items found in RSS feed: ${feedUrl}`);
        return [];
      }

      logger.info(`Found ${feed.items.length} items in RSS feed: ${feedUrl}`);

      for (const item of feed.items) {
        try {
          const job = this.normalizeRSSItem(item, query);
          if (job && this.matchesQuery(job, query)) {
            jobs.push(job);
          }
        } catch (error: any) {
          logger.warn(`Error normalizing RSS item:`, error.message);
          // Continue with next item
        }
      }

      logger.info(`Filtered to ${jobs.length} matching jobs from ${feedUrl}`);
      return jobs;
    } catch (error: any) {
      logger.error(`Error parsing RSS feed ${feedUrl}:`, error.message || error);
      // Don't throw - return empty array so other feeds can still work
      return [];
    }
  }

  /**
   * Normalize RSS item to ApplyJob
   */
  protected normalizeJob(rawJob: any): ApplyJob {
    // This is handled by normalizeRSSItem
    return this.normalizeRSSItem(rawJob, {});
  }

  private normalizeRSSItem(item: any, query: ProviderQuery): ApplyJob | null {
    if (!item.title || !item.link) {
      return null;
    }

    const description = item.contentSnippet || item.content || item.description || '';
    const location = item.location || item['location:name'] || '';
    const company = item.company || item['company:name'] || this.extractCompanyFromTitle(item.title);
    const isRemote = this.isRemoteJob(location, description) || query.remote === true;
    const applyEmail = this.extractApplyEmail(description, item.link);
    const jobHash = this.generateJobHash({
      source: 'rss',
      external_id: item.guid || item.link,
      title: item.title,
      company,
      job_url: item.link,
    });

    return {
      id: '', // Will be set when saved to DB
      external_id: item.guid || item.link?.split('/').pop() || null,
      source: 'rss',
      title: item.title.trim(),
      company: company || undefined,
      location: location || (isRemote ? 'Remote' : undefined),
      description: description.substring(0, 5000), // Limit description length
      job_url: item.link,
      application_url: item.link,
      application_method: applyEmail ? 'email' : 'url',
      apply_email: applyEmail || undefined,
      is_remote: isRemote,
      posted_date: item.pubDate ? new Date(item.pubDate) : new Date(),
      job_hash: jobHash,
      raw_data: {
        guid: item.guid,
        categories: item.categories,
      },
    } as any;
  }

  /**
   * Extract company name from job title (fallback)
   */
  private extractCompanyFromTitle(title: string): string | null {
    // Try to extract company from patterns like "Company Name - Job Title"
    const match = title.match(/^([^-]+?)\s*[-–—]\s*/);
    return match ? match[1].trim() : null;
  }

  /**
   * Check if job matches query criteria
   */
  private matchesQuery(job: ApplyJob, query: ProviderQuery): boolean {
    // If no filters specified, accept all jobs
    if ((!query.jobTitles || query.jobTitles.length === 0) && 
        (!query.keywords || query.keywords.length === 0) &&
        query.remote === undefined) {
      return true;
    }

    // Filter by job titles
    if (query.jobTitles && query.jobTitles.length > 0) {
      const titleLower = job.title.toLowerCase();
      const matchesTitle = query.jobTitles.some(title =>
        titleLower.includes(title.toLowerCase())
      );
      if (!matchesTitle) return false;
    }

    // Filter by keywords
    if (query.keywords && query.keywords.length > 0) {
      const text = `${job.title} ${job.description || ''}`.toLowerCase();
      const matchesKeyword = query.keywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );
      if (!matchesKeyword) return false;
    }

    // Filter by remote preference
    if (query.remote === true && !job.is_remote) {
      return false;
    }

    return true;
  }
}

