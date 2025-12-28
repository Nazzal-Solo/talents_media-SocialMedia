import { ApplyService, ApplyProfile, ApplyJob } from './applyService';
import { query } from '../models/db';
import { logger } from '../middlewares';

export interface MatchResult {
  job: ApplyJob;
  score: number;
  reasons: string[];
}

export class JobMatchingService {
  constructor(private applyService: ApplyService) {}

  /**
   * Match jobs against a user profile
   */
  async matchJobs(profile: ApplyProfile, jobs: ApplyJob[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const job of jobs) {
      const match = this.matchJob(profile, job);
      if (match.score > 0) {
        results.push(match);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Match a single job against a profile
   */
  private matchJob(profile: ApplyProfile, job: ApplyJob): MatchResult {
    let score = 0;
    const reasons: string[] = [];

    // Check if already applied
    // This will be checked separately in the automation service

    // Title matching (40 points max)
    if (profile.job_titles.length > 0 && job.title) {
      const titleLower = job.title.toLowerCase();
      const matchedTitle = profile.job_titles.some(title =>
        titleLower.includes(title.toLowerCase()) || title.toLowerCase().includes(titleLower)
      );
      if (matchedTitle) {
        score += 40;
        reasons.push(`Job title matches: "${job.title}"`);
      }
    }

    // Skills matching (30 points max)
    if (profile.skills.length > 0 && job.description) {
      const descLower = job.description.toLowerCase();
      const matchedSkills = profile.skills.filter(skill =>
        descLower.includes(skill.toLowerCase())
      );
      if (matchedSkills.length > 0) {
        const skillScore = Math.min(30, (matchedSkills.length / profile.skills.length) * 30);
        score += skillScore;
        reasons.push(`Matched ${matchedSkills.length} skills: ${matchedSkills.slice(0, 3).join(', ')}`);
      }
    }

    // Location matching (20 points max)
    if (profile.locations.length > 0) {
      // Check remote preference
      const wantsRemote = profile.locations.some(loc =>
        ['remote', 'anywhere', 'global', 'worldwide'].some(keyword =>
          loc.toLowerCase().includes(keyword)
        )
      );

      if (wantsRemote && job.is_remote) {
        score += 20;
        reasons.push('Remote position matches preference');
      } else if (job.location) {
        const jobLocationLower = job.location.toLowerCase();
        const matchedLocation = profile.locations.some(loc =>
          jobLocationLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLocationLower)
        );
        if (matchedLocation) {
          score += 20;
          reasons.push(`Location matches: ${job.location}`);
        }
      }
    } else if (job.is_remote) {
      // If no location preference but job is remote, give some points
      score += 10;
      reasons.push('Remote position available');
    }

    // Salary matching (10 points max)
    if (profile.salary_min && job.salary_min) {
      if (job.salary_min >= profile.salary_min) {
        score += 10;
        reasons.push(`Salary meets minimum requirement`);
      }
    }

    // Include keywords (bonus points)
    if (profile.include_keywords.length > 0 && job.description) {
      const descLower = job.description.toLowerCase();
      const matchedKeywords = profile.include_keywords.filter(keyword =>
        descLower.includes(keyword.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        score += matchedKeywords.length * 2;
        reasons.push(`Contains keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
      }
    }

    // Exclude keywords (negative points)
    if (profile.exclude_keywords.length > 0 && job.description) {
      const descLower = job.description.toLowerCase();
      const matchedExcludes = profile.exclude_keywords.filter(keyword =>
        descLower.includes(keyword.toLowerCase())
      );
      if (matchedExcludes.length > 0) {
        score = Math.max(0, score - matchedExcludes.length * 20);
        reasons.push(`Contains excluded keywords: ${matchedExcludes.join(', ')}`);
      }
    }

    // Normalize score to 0-100
    score = Math.min(100, Math.max(0, score));

    return {
      job,
      score,
      reasons: reasons.length > 0 ? reasons : ['Basic match'],
    };
  }

  /**
   * Find jobs from various sources
   * For MVP, we'll use a simple approach with public job boards
   */
  async findJobs(limit: number = 50): Promise<ApplyJob[]> {
    // For MVP, we'll fetch from a simple source
    // In production, this would integrate with job APIs like:
    // - Adzuna API
    // - Reed API
    // - Indeed API (if available)
    // - GitHub Jobs API
    // - RemoteOK API
    
    // For now, return jobs from database that haven't expired
    const result = await query(
      `SELECT * FROM apply_jobs
       WHERE (expires_date IS NULL OR expires_date > NOW())
       AND posted_date > NOW() - INTERVAL '30 days'
       ORDER BY posted_date DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Fetch jobs from a specific source (placeholder for future integrations)
   */
  async fetchJobsFromSource(source: string): Promise<ApplyJob[]> {
    // This is a placeholder for future job source integrations
    // For MVP, we'll manually add jobs or use a simple scraping approach
    
    logger.info(`Fetching jobs from source: ${source}`);
    
    // Return empty array for now - jobs will be added manually or via admin
    return [];
  }
}

