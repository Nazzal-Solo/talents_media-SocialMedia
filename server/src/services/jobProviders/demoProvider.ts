import { BaseProvider, ProviderQuery, ApplyJob } from './baseProvider';
import { logger } from '../../middlewares';

/**
 * Demo Provider
 * Generates sample jobs for MVP/testing when real RSS feeds aren't available
 */
export class DemoProvider extends BaseProvider {
  constructor() {
    super({
      name: 'demo',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
      },
    });
  }

  async fetchJobs(query: ProviderQuery): Promise<ApplyJob[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      logger.info('Demo provider: Generating sample jobs for testing');
      
      // Generate sample jobs based on query
      const jobs: ApplyJob[] = [];
      const jobTitles = query.jobTitles || ['Software Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer'];
      const keywords = query.keywords || ['React', 'Node.js', 'JavaScript', 'TypeScript'];
      const companies = ['TechCorp', 'DevStart', 'CodeBase Inc', 'InnovateTech', 'CloudSolutions', 'DataFlow', 'WebCraft', 'AppBuilders'];
      
      // Generate 5-10 sample jobs
      const numJobs = Math.min(8, Math.max(5, jobTitles.length + keywords.length));
      
      for (let i = 0; i < numJobs; i++) {
        const titleIndex = i % jobTitles.length;
        const companyIndex = i % companies.length;
        const keywordIndex = i % keywords.length;
        
        const jobTitle = jobTitles[titleIndex] || 'Software Developer';
        const company = companies[companyIndex];
        const keyword = keywords[keywordIndex] || 'JavaScript';
        const isRemote = query.remote !== false; // Default to remote
        
        // Generate unique ID
        const jobId = `demo_${Date.now()}_${i}`;

        const job: ApplyJob = {
          id: '', // Will be set when saved
          external_id: jobId,
          source: 'demo',
          title: `${jobTitle} - ${keyword}`,
          company,
          location: isRemote ? 'Remote' : 'San Francisco, CA',
          description: `We are looking for an experienced ${jobTitle} with strong skills in ${keyword} and related technologies. This is a ${isRemote ? 'remote' : 'hybrid'} position offering competitive salary and benefits.`,
          salary_min: 80000 + (i * 5000),
          salary_max: 120000 + (i * 10000),
          salary_currency: 'USD',
          job_url: `https://example.com/jobs/${jobId}`,
          application_url: `https://example.com/apply/${jobId}`,
          application_method: 'url',
          apply_email: `careers@${company.toLowerCase().replace(/\s+/g, '')}.com`,
          is_remote: isRemote,
          posted_date: new Date(Date.now() - i * 86400000), // Posted 0-7 days ago
          job_hash: '', // Will be generated when saved
          raw_data: {
            demo: true,
            generated_at: new Date().toISOString(),
          },
        } as any;

        jobs.push(job);
      }

      logger.info(`Demo provider: Generated ${jobs.length} sample jobs`);
      return jobs;
    } catch (error: any) {
      logger.error('Demo provider error:', error);
      return [];
    }
  }

  protected normalizeJob(rawJob: any): ApplyJob {
    return rawJob;
  }
}

