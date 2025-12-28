import { BaseProvider, ProviderQuery } from './baseProvider';
import { ApplyJob } from '../applyService';
import { logger } from '../../middlewares';

/**
 * GitHub Jobs API Provider
 * Note: GitHub Jobs API was discontinued, but this serves as a template
 * for similar REST API-based job providers
 */
export class GitHubJobsProvider extends BaseProvider {
  private baseUrl = 'https://jobs.github.com/positions.json';

  constructor() {
    super({
      name: 'github_jobs',
      enabled: false, // Disabled since GitHub Jobs API is discontinued
      rateLimit: {
        requestsPerMinute: 5,
        requestsPerHour: 50,
      },
    });
  }

  async fetchJobs(query: ProviderQuery): Promise<ApplyJob[]> {
    // GitHub Jobs API is discontinued, but this shows the pattern
    // For MVP, we'll use RSS feeds instead
    logger.warn('GitHub Jobs API is discontinued, skipping');
    return [];
  }

  protected normalizeJob(rawJob: any): ApplyJob {
    const description = rawJob.description || '';
    const isRemote = this.isRemoteJob(rawJob.location, description);
    const applyEmail = this.extractApplyEmail(description, rawJob.url);
    const jobHash = this.generateJobHash({
      source: 'github_jobs',
      external_id: rawJob.id,
      title: rawJob.title,
      company: rawJob.company,
      job_url: rawJob.url,
    });

    return {
      id: '',
      external_id: rawJob.id,
      source: 'github_jobs',
      title: rawJob.title,
      company: rawJob.company,
      location: rawJob.location || (isRemote ? 'Remote' : undefined),
      description: description.substring(0, 5000),
      job_url: rawJob.url,
      application_url: rawJob.url,
      application_method: applyEmail ? 'email' : 'url',
      apply_email: applyEmail || undefined,
      is_remote: isRemote,
      posted_date: rawJob.created_at ? new Date(rawJob.created_at) : new Date(),
      job_hash: jobHash,
      raw_data: rawJob,
    } as any;
  }
}

