import { ApplyService, ApplyProfile, ApplyJob } from './applyService';
import { JobMatchingService, MatchResult } from './jobMatchingService';
import { SourceGeneratorService } from './sourceGeneratorService';
import { providerRegistry } from './jobProviders';
import { query } from '../models/db';
import { logger } from '../middlewares';
import nodemailer from 'nodemailer';

export class AutomationService {
  private emailTransporter: any;

  constructor(
    private applyService: ApplyService,
    private jobMatchingService: JobMatchingService,
    private sourceGenerator: SourceGeneratorService
  ) {
    // Initialize email transporter if configured
    this.initEmailTransporter();
  }

  /**
   * Initialize email transporter for auto-email apply
   */
  private initEmailTransporter(): void {
    // Only initialize if email is configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      logger.info('Email transporter initialized for auto-apply');
    } else {
      logger.warn('Email not configured - auto-email apply will be disabled');
    }
  }

  /**
   * Run automated job application for a user
   */
  async runAutoApply(userId: string, runId?: string): Promise<void> {
    try {
      logger.info(`Starting auto-apply for user: ${userId}`);

      // Get user profile
      const profile = await this.applyService.getProfile(userId);
      if (!profile) {
        logger.warn(`No profile found for user: ${userId}`);
        await this.applyService.createActivityLog(userId, 'auto_apply_skipped', {
          reason: 'No profile configured',
        });
        return;
      }

      // Check if auto-apply is enabled
      if (!profile.auto_apply_enabled) {
        logger.info(`Auto-apply disabled for user: ${userId}`);
        return;
      }

      // Check if user has an active plan
      const userPlan = await this.applyService.getUserPlan(userId);
      if (!userPlan) {
        logger.warn(`No active plan for user: ${userId}`);
        await this.applyService.createActivityLog(userId, 'auto_apply_skipped', {
          reason: 'No active plan',
        });
        return;
      }

      // Generate/update sources from profile
      logger.info(`Generating sources for user: ${userId}`);
      await this.sourceGenerator.regenerateSourcesForUser(userId, profile);
      await this.applyService.createActivityLog(userId, 'source_generation_completed', {
        run_id: runId,
        status: 'completed',
      });

      // Fetch jobs from all sources FIRST (before checking daily limit)
      // This ensures we show progress even if limit is reached
      logger.info(`Fetching jobs for user: ${userId}`);
      await this.applyService.createActivityLog(userId, 'source_fetch_start', {
        run_id: runId,
        status: 'fetching',
        message: 'Starting to fetch jobs from sources...',
      });
      
      const fetchedJobs = await this.fetchJobsFromSources(userId, profile);
      
      // Log progress update
      await this.applyService.createActivityLog(userId, 'source_fetch_progress', {
        run_id: runId,
        status: 'fetching',
        jobs_found: fetchedJobs.length,
        message: `Found ${fetchedJobs.length} jobs, starting to match...`,
      });

      if (fetchedJobs.length === 0) {
        logger.warn(`No jobs fetched for user: ${userId}. This could mean:`);
        logger.warn(`1. RSS feeds are not accessible or have changed`);
        logger.warn(`2. Profile needs more job titles/keywords`);
        logger.warn(`3. All feeds returned empty results`);
        logger.warn(`4. Network/rate limiting issues`);
        
        await this.applyService.createActivityLog(userId, 'source_fetch', {
          run_id: runId,
          jobs_fetched: 0,
          status: 'completed',
          warning: 'No jobs found. Check profile keywords and RSS feed availability.',
        });
        await this.applyService.createActivityLog(userId, 'auto_apply_completed', {
          run_id: runId,
          applied: 0,
          failed: 0,
          status: 'completed',
          reason: 'No jobs available to apply',
        });
        return;
      }

      await this.applyService.createActivityLog(userId, 'source_fetch', {
        run_id: runId,
        jobs_fetched: fetchedJobs.length,
        status: 'completed',
      });

      // NOW check daily limit AFTER fetching jobs
      const dailyLimit = await this.applyService.getDailyLimit(userId);
      const today = new Date();
      const appliedToday = await this.applyService.getDailyQuota(userId, today);

      if (appliedToday >= dailyLimit) {
        logger.info(`Daily limit reached for user: ${userId} (${appliedToday}/${dailyLimit})`);
        await this.applyService.createActivityLog(userId, 'auto_apply_limit_reached', {
          run_id: runId,
          applied: appliedToday,
          limit: dailyLimit,
          jobs_fetched: fetchedJobs.length,
        });
        await this.applyService.createActivityLog(userId, 'auto_apply_completed', {
          run_id: runId,
          applied: 0,
          failed: 0,
          status: 'completed',
          reason: 'Daily limit already reached',
        });
        return;
      }

      const remaining = dailyLimit - appliedToday;

      // Get already applied jobs
      const applications = await this.applyService.getApplications(userId);
      const appliedJobIds = new Set(applications.applications.map(a => a.job_id));

      // Filter out already applied jobs
      const newJobs = fetchedJobs.filter(job => !appliedJobIds.has(job.id));

      // Match jobs
      logger.info(`Matching ${newJobs.length} jobs for user: ${userId}`);
      await this.applyService.createActivityLog(userId, 'match_start', {
        run_id: runId,
        status: 'matching',
        jobs_to_match: newJobs.length,
        message: `Matching ${newJobs.length} jobs against your profile...`,
      });
      
      const matches = await this.jobMatchingService.matchJobs(profile, newJobs);
      
      await this.applyService.createActivityLog(userId, 'match_progress', {
        run_id: runId,
        status: 'matching',
        matched_count: matches.length,
        message: `Matched ${matches.length} jobs, filtering by score...`,
      });

      // Filter matches by minimum score (30)
      const goodMatches = matches.filter(m => m.score >= 30);

      // Sort by score and take top matches up to remaining limit
      const jobsToApply = goodMatches
        .slice(0, remaining)
        .map(m => m.job);

      logger.info(`Found ${jobsToApply.length} jobs to apply for user: ${userId}`);

      // Create job matches records
      for (const match of goodMatches.slice(0, remaining)) {
        await this.applyService.createJobMatch(
          userId,
          match.job.id,
          match.score,
          match.reasons,
          'queued'
        );
      }

      await this.applyService.createActivityLog(userId, 'match_created', {
        run_id: runId,
        matched: goodMatches.length,
        queued: jobsToApply.length,
      });

      // Apply to jobs
      let appliedCount = 0;
      let failedCount = 0;
      let assistedCount = 0;
      const totalJobs = jobsToApply.length;
      const startTime = Date.now();

      for (let i = 0; i < jobsToApply.length; i++) {
        const job = jobsToApply[i];
        const currentJobIndex = i + 1;
        const remainingJobs = totalJobs - currentJobIndex;
        
        try {
          // Log current job being processed
          await this.applyService.createActivityLog(userId, 'job_processing', {
            run_id: runId,
            job_id: job.id,
            job_title: job.title,
            job_company: job.company,
            current_index: currentJobIndex,
            total_jobs: totalJobs,
            remaining: remainingJobs,
          });

          const match = matches.find(m => m.job.id === job.id);
          const matchScore = match?.score || 0;
          const matchReasons = match?.reasons || [];

          // Determine apply method
          const applyMethod = await this.determineApplyMethod(job);

          if (applyMethod === 'email_auto' && this.emailTransporter) {
            // Auto-email apply
            await this.applyViaEmail(userId, job, matchScore, matchReasons);
            await this.applyService.incrementDailyQuota(userId, today);
            appliedCount++;
            await this.applyService.createActivityLog(userId, 'application_created', {
              run_id: runId,
              job_id: job.id,
              job_title: job.title,
              job_company: job.company,
              method: 'email_auto',
              applied: appliedCount,
              current_index: currentJobIndex,
              total_jobs: totalJobs,
            });
          } else if (applyMethod === 'assisted') {
            // Assisted apply
            await this.createAssistedApply(userId, job, matchScore, matchReasons);
            await this.applyService.incrementDailyQuota(userId, today);
            assistedCount++;
            await this.applyService.createActivityLog(userId, 'application_created', {
              run_id: runId,
              job_id: job.id,
              job_title: job.title,
              job_company: job.company,
              method: 'assisted',
              assisted: assistedCount,
              current_index: currentJobIndex,
              total_jobs: totalJobs,
            });
          } else {
            // Fallback: mark as assisted
            await this.createAssistedApply(userId, job, matchScore, matchReasons);
            await this.applyService.incrementDailyQuota(userId, today);
            assistedCount++;
            await this.applyService.createActivityLog(userId, 'application_created', {
              run_id: runId,
              job_id: job.id,
              job_title: job.title,
              job_company: job.company,
              method: 'assisted',
              assisted: assistedCount,
              current_index: currentJobIndex,
              total_jobs: totalJobs,
            });
          }

          // Update job match status
          await this.applyService.createJobMatch(
            userId,
            job.id,
            matchScore,
            matchReasons,
            applyMethod === 'email_auto' ? 'applied' : 'assisted_required'
          );

          logger.info(`Processed job ${job.id} for user: ${userId} (method: ${applyMethod})`);

          // Small delay between applications
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          failedCount++;
          logger.error(`Failed to apply to job ${job.id} for user ${userId}:`, error);

          const match = matches.find(m => m.job.id === job.id);
          await this.applyService.createApplication(userId, job.id, {
            status: 'failed',
            match_score: match?.score,
            match_reason: match?.reasons.join('; '),
            application_details: { error: String(error) },
          });

          await this.applyService.createJobMatch(
            userId,
            job.id,
            match?.score || 0,
            match?.reasons || [],
            'failed'
          );

          await this.applyService.createActivityLog(userId, 'application_failed', {
            run_id: runId,
            job_id: job.id,
            job_title: job.title,
            job_company: job.company,
            error: String(error),
            current_index: currentJobIndex,
            total_jobs: totalJobs,
          });
        }
      }

      // Log summary
      await this.applyService.createActivityLog(userId, 'auto_apply_completed', {
        run_id: runId,
        applied: appliedCount,
        assisted: assistedCount,
        failed: failedCount,
        total_matched: goodMatches.length,
        status: 'completed',
      });

      logger.info(
        `Auto-apply completed for user: ${userId} - Applied: ${appliedCount}, Assisted: ${assistedCount}, Failed: ${failedCount}`
      );
    } catch (error: any) {
      logger.error(`Auto-apply error for user ${userId}:`, error);
      await this.applyService.createActivityLog(userId, 'auto_apply_error', {
        error: String(error),
      });
    }
  }

  /**
   * Fetch jobs from user's sources
   * Includes deduplication and caching
   */
  private async fetchJobsFromSources(userId: string, profile: ApplyProfile): Promise<ApplyJob[]> {
    const sources = await this.sourceGenerator.getSourcesForUser(userId);
    const allJobs: ApplyJob[] = [];
    const seenHashes = new Set<string>(); // In-memory deduplication

    for (const source of sources) {
      if (!source.enabled) continue;

      try {
        logger.info(`Fetching jobs from source ${source.provider} for user ${userId}`);

        // Rate limiting: delay between sources
        if (allJobs.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        let jobs = await providerRegistry.fetchJobsFromProvider(
          source.provider,
          source.query_params
        );

        // Note: Demo provider is disabled - we use real job APIs instead
        // If you need test jobs, you can enable demo provider in the registry

        // Deduplicate and save jobs
        for (const job of jobs) {
          // Generate hash if not present
          if (!job.job_hash) {
            const crypto = require('crypto');
            const hashInput = `${job.source || ''}_${job.external_id || ''}_${job.title || ''}_${job.company || ''}_${job.job_url || ''}`;
            job.job_hash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 64);
          }

          // Skip if already seen in this run
          if (seenHashes.has(job.job_hash)) {
            continue;
          }

          // Check for duplicates in database
          const existing = await this.applyService.findJobByHash(job.job_hash);

          if (!existing) {
            // Save new job
            try {
              const savedJob = await this.applyService.createJob(job);
              allJobs.push(savedJob);
              seenHashes.add(job.job_hash);
            } catch (error: any) {
              // Handle unique constraint violations (duplicate external_id)
              if (error.message?.includes('duplicate') || error.code === '23505') {
                logger.warn(`Duplicate job detected: ${job.title}`);
                // Try to find existing job
                const existingJob = await this.applyService.findJobByExternalId(
                  job.source,
                  job.external_id || ''
                );
                if (existingJob) {
                  allJobs.push(existingJob);
                  seenHashes.add(job.job_hash);
                }
              } else {
                throw error;
              }
            }
          } else {
            // Use existing job
            allJobs.push(existing);
            seenHashes.add(existing.job_hash || '');
          }
        }

        // Update source fetch time
        await this.sourceGenerator.updateSourceFetchTime(source.id, true);

        logger.info(`Fetched ${jobs.length} jobs from ${source.provider} (${allJobs.length} unique)`);
      } catch (error: any) {
        logger.error(`Error fetching from source ${source.provider}:`, error);
        await this.sourceGenerator.updateSourceFetchTime(source.id, false, error.message);
        // Continue with other sources - don't fail entire run
      }
    }

    return allJobs;
  }

  /**
   * Determine apply method for a job
   */
  private async determineApplyMethod(job: ApplyJob): Promise<'email_auto' | 'assisted' | 'api'> {
    // Check if job has apply email
    if (job.apply_email) {
      return 'email_auto';
    }

    // Check if provider supports API apply (future)
    // For now, return assisted
    return 'assisted';
  }

  /**
   * Apply via email (auto-apply)
   */
  private async applyViaEmail(
    userId: string,
    job: ApplyJob,
    matchScore: number,
    matchReasons: string[]
  ): Promise<void> {
    if (!this.emailTransporter || !job.apply_email) {
      throw new Error('Email not configured or no apply email found');
    }

    // Get user info
    const userResult = await query('SELECT email, display_name FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) {
      throw new Error('User not found');
    }

    // Get user profile for CV
    const profile = await this.applyService.getProfile(userId);

    // Generate cover letter
    const coverLetter = this.generateCoverLetter(job, profile, matchReasons);

    // Prepare email
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || user.email;
    const mailOptions = {
      from: fromEmail,
      to: job.apply_email,
      replyTo: user.email,
      subject: `Application for ${job.title}${job.company ? ` at ${job.company}` : ''}`,
      text: coverLetter.text,
      html: coverLetter.html,
      attachments: profile?.cv_url ? [
        {
          filename: 'resume.pdf',
          path: profile.cv_url, // Note: In production, download from Cloudinary first
        },
      ] : undefined,
    };

    // Send email
    await this.emailTransporter.sendMail(mailOptions);

    // Create application record
    await this.applyService.createApplication(userId, job.id, {
      status: 'applied',
      match_score: matchScore,
      match_reason: matchReasons.join('; '),
      application_method: 'email_auto',
      application_details: {
        email_sent_to: job.apply_email,
        sent_at: new Date().toISOString(),
      },
    });

    await this.applyService.createActivityLog(userId, 'applied', {
      job_id: job.id,
      method: 'email_auto',
      email: job.apply_email,
    });
  }

  /**
   * Create assisted apply record
   */
  private async createAssistedApply(
    userId: string,
    job: ApplyJob,
    matchScore: number,
    matchReasons: string[]
  ): Promise<void> {
    // Get user profile for cover letter generation
    const profile = await this.applyService.getProfile(userId);
    const coverLetter = this.generateCoverLetter(job, profile, matchReasons);

    // Create application record with assisted status
    await this.applyService.createApplication(userId, job.id, {
      status: 'assisted_required',
      match_score: matchScore,
      match_reason: matchReasons.join('; '),
      application_method: 'assisted',
      application_details: {
        apply_url: job.application_url || job.job_url,
        cover_letter_text: coverLetter.text,
        cover_letter_html: coverLetter.html,
        email_subject: `Application for ${job.title}${job.company ? ` at ${job.company}` : ''}`,
        created_at: new Date().toISOString(),
      },
    });

    await this.applyService.createActivityLog(userId, 'assisted_ready', {
      job_id: job.id,
      apply_url: job.application_url || job.job_url,
    });
  }

  /**
   * Generate cover letter text
   */
  private generateCoverLetter(
    job: ApplyJob,
    profile: ApplyProfile | null,
    matchReasons: string[]
  ): { text: string; html: string } {
    const userName = profile ? 'Your Name' : 'Candidate'; // In production, get from user table
    const skills = profile?.skills?.slice(0, 5).join(', ') || 'relevant skills';
    const jobTitles = profile?.job_titles?.join(' or ') || 'this position';

    const text = `Dear Hiring Manager,

I am writing to express my interest in the ${job.title} position${job.company ? ` at ${job.company}` : ''}.

${matchReasons.length > 0 ? `I believe I am a strong fit for this role because: ${matchReasons.slice(0, 3).join(', ')}.` : 'I believe my experience and skills align well with the requirements.'}

My background includes ${skills}, and I have experience in ${jobTitles} roles. I am excited about the opportunity to contribute to your team.

Please find my resume attached. I look forward to discussing how my skills and experience can benefit your organization.

Best regards,
${userName}`;

    const html = `<p>Dear Hiring Manager,</p>
<p>I am writing to express my interest in the <strong>${job.title}</strong> position${job.company ? ` at ${job.company}` : ''}.</p>
<p>${matchReasons.length > 0 ? `I believe I am a strong fit for this role because: ${matchReasons.slice(0, 3).join(', ')}.` : 'I believe my experience and skills align well with the requirements.'}</p>
<p>My background includes ${skills}, and I have experience in ${jobTitles} roles. I am excited about the opportunity to contribute to your team.</p>
<p>Please find my resume attached. I look forward to discussing how my skills and experience can benefit your organization.</p>
<p>Best regards,<br>${userName}</p>`;

    return { text, html };
  }

  /**
   * Run auto-apply for all eligible users
   */
  async runAutoApplyForAllUsers(): Promise<void> {
    try {
      logger.info('Starting auto-apply for all eligible users');

      // Get all users with auto-apply enabled and active plans, including their preferred run time
      const result = await query(
        `SELECT DISTINCT p.user_id, p.preferred_run_time
         FROM apply_profiles p
         JOIN apply_user_plans up ON p.user_id = up.user_id
         WHERE p.auto_apply_enabled = TRUE
         AND up.status = 'active'
         AND (up.expires_at IS NULL OR up.expires_at > NOW())`
      );

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      // Filter users whose preferred time matches current time (within 1 hour window)
      const eligibleUsers = result.rows.filter((row: any) => {
        if (!row.preferred_run_time) {
          // If no preferred time, run at default time (2 AM)
          return currentHour === 2 && currentMinute < 30;
        }
        
        const [prefHour, prefMinute] = row.preferred_run_time.split(':').map(Number);
        // Run if current time is within 30 minutes of preferred time
        const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (prefHour * 60 + prefMinute));
        return timeDiff <= 30;
      });

      logger.info(`Found ${eligibleUsers.length} users ready for auto-apply (out of ${result.rows.length} eligible)`);

      // Run auto-apply for each eligible user
      for (const user of eligibleUsers) {
        try {
          await this.runAutoApply(user.user_id);
          // Delay between users to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          logger.error(`Error running auto-apply for user ${user.user_id}:`, error);
          // Continue with next user
        }
      }

      logger.info('Completed auto-apply for all eligible users');
    } catch (error) {
      logger.error('Error running auto-apply for all users:', error);
    }
  }
}
