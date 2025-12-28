import { query } from '../models/db';
import { ApplyProfile } from './applyService';
import { ProviderQuery } from './jobProviders/baseProvider';
import { logger } from '../middlewares';

export interface GeneratedSource {
  provider: string;
  queryParams: ProviderQuery;
  enabled: boolean;
}

/**
 * Source Generator Service
 * Automatically generates job sources from user profiles
 */
export class SourceGeneratorService {
  /**
   * Generate sources for a user based on their profile
   */
  async generateSourcesForUser(userId: string, profile: ApplyProfile): Promise<GeneratedSource[]> {
    const sources: GeneratedSource[] = [];

    // Extract profile data
    const jobTitles = profile.job_titles || [];
    const skills = profile.skills || [];
    const includeKeywords = profile.include_keywords || [];
    const locations = profile.locations || [];

    // Check if user wants remote jobs
    const wantsRemote = this.hasRemotePreference(locations);

    // Build keywords from skills and include_keywords
    const keywords = [...skills, ...includeKeywords].filter(Boolean);

    // Generate Adzuna API source (real jobs, free tier)
    if (jobTitles.length > 0 || keywords.length > 0) {
      sources.push({
        provider: 'adzuna',
        queryParams: {
          jobTitles: jobTitles.length > 0 ? jobTitles : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          remote: wantsRemote,
          limit: 50, // Fetch up to 50 jobs per source
        },
        enabled: true,
      });
    }

    // Generate Findwork API source (real jobs, requires API key)
    if (jobTitles.length > 0 || keywords.length > 0) {
      sources.push({
        provider: 'findwork',
        queryParams: {
          jobTitles: jobTitles.length > 0 ? jobTitles : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          remote: wantsRemote,
          limit: 50, // Fetch up to 50 jobs per source
        },
        enabled: true,
      });
    }

    // Generate RSS provider source (fallback)
    if (jobTitles.length > 0 || keywords.length > 0) {
      sources.push({
        provider: 'rss',
        queryParams: {
          jobTitles: jobTitles.length > 0 ? jobTitles : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          remote: wantsRemote,
          limit: 100, // Fetch up to 100 jobs per source
        },
        enabled: true,
      });
    }

    // Future: Add more providers here
    // - Adzuna API
    // - Reed API
    // - etc.

    return sources;
  }

  /**
   * Check if user has remote preference
   */
  private hasRemotePreference(locations: string[]): boolean {
    if (!locations || locations.length === 0) {
      // If no location specified, assume remote preference
      return true;
    }

    const remoteKeywords = ['remote', 'anywhere', 'global', 'worldwide', 'wfh', 'work from home'];
    return locations.some(loc =>
      remoteKeywords.some(keyword => loc.toLowerCase().includes(keyword))
    );
  }

  /**
   * Save or update sources for a user
   */
  async saveSourcesForUser(userId: string, sources: GeneratedSource[]): Promise<void> {
    try {
      // Delete existing sources for this user
      await query('DELETE FROM apply_sources WHERE user_id = $1', [userId]);

      // Insert new sources
      for (const source of sources) {
        await query(
          `INSERT INTO apply_sources (user_id, provider, query_params, enabled)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, provider, query_params) DO UPDATE SET
             enabled = EXCLUDED.enabled,
             updated_at = NOW()`,
          [
            userId,
            source.provider,
            JSON.stringify(source.queryParams),
            source.enabled,
          ]
        );
      }

      logger.info(`Saved ${sources.length} sources for user ${userId}`);
    } catch (error) {
      logger.error(`Error saving sources for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get sources for a user
   */
  async getSourcesForUser(userId: string): Promise<any[]> {
    try {
      const result = await query(
        'SELECT * FROM apply_sources WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      return result.rows.map(row => ({
        ...row,
        query_params: typeof row.query_params === 'string' 
          ? JSON.parse(row.query_params) 
          : row.query_params,
      }));
    } catch (error) {
      logger.error(`Error getting sources for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Update source last_fetched_at
   */
  async updateSourceFetchTime(sourceId: string, success: boolean, error?: string): Promise<void> {
    try {
      if (success) {
        await query(
          `UPDATE apply_sources 
           SET last_fetched_at = NOW(), 
               last_error = NULL, 
               error_count = 0,
               updated_at = NOW()
           WHERE id = $1`,
          [sourceId]
        );
      } else {
        await query(
          `UPDATE apply_sources 
           SET last_error = $2, 
               error_count = error_count + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [sourceId, error || 'Unknown error']
        );
      }
    } catch (error) {
      logger.error(`Error updating source fetch time:`, error);
    }
  }

  /**
   * Regenerate sources when profile changes
   */
  async regenerateSourcesForUser(userId: string, profile: ApplyProfile): Promise<void> {
    const sources = await this.generateSourcesForUser(userId, profile);
    await this.saveSourcesForUser(userId, sources);
  }
}

