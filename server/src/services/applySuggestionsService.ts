import { query } from '../models/db';
import { logger } from '../middlewares';

export type SuggestionType = 'skill' | 'job_title' | 'keyword' | 'location';

export interface Suggestion {
  value: string;
  usage_count?: number;
  is_user_history?: boolean;
}

export class ApplySuggestionsService {
  // Curated seed data for common tech skills and job titles
  private seedData: Record<SuggestionType, string[]> = {
    skill: [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'C#',
      'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'SQL', 'PostgreSQL',
      'MySQL', 'MongoDB', 'Redis', 'AWS', 'Docker', 'Kubernetes', 'Git', 'Linux',
      'HTML', 'CSS', 'SASS', 'Tailwind CSS', 'Vue.js', 'Angular', 'Next.js',
      'Express.js', 'Django', 'Flask', 'Spring Boot', 'GraphQL', 'REST API',
      'Microservices', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Terraform',
      'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas',
      'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Wireframing', 'Prototyping'
    ],
    job_title: [
      'Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
      'DevOps Engineer', 'Cloud Engineer', 'Data Engineer', 'Data Scientist',
      'Machine Learning Engineer', 'Mobile Developer', 'iOS Developer', 'Android Developer',
      'UI/UX Designer', 'Product Designer', 'Graphic Designer', 'Web Designer',
      'Product Manager', 'Project Manager', 'Scrum Master', 'QA Engineer',
      'Test Engineer', 'Security Engineer', 'Site Reliability Engineer', 'Database Administrator',
      'Solutions Architect', 'Technical Lead', 'Engineering Manager', 'CTO',
      'Junior Developer', 'Senior Developer', 'Principal Engineer'
    ],
    keyword: [
      'remote', 'hybrid', 'onsite', 'full-time', 'part-time', 'contract', 'freelance',
      'startup', 'enterprise', 'agile', 'scrum', 'kanban', 'microservices',
      'cloud-native', 'serverless', 'blockchain', 'cryptocurrency', 'fintech',
      'healthtech', 'edtech', 'e-commerce', 'SaaS', 'B2B', 'B2C'
    ],
    location: [] // Locations will come from Nominatim API
  };

  /**
   * Get suggestions for a given type
   */
  async getSuggestions(
    type: SuggestionType,
    userId: string,
    query: string = '',
    limit: number = 20
  ): Promise<Suggestion[]> {
    try {
      const queryLower = query.toLowerCase().trim();
      
      // Get user's history
      const userHistory = await this.getUserHistory(type, userId);
      
      // Get popular suggestions from cache
      const popularSuggestions = await this.getPopularSuggestions(type, queryLower, limit);
      
      // Get seed data matches
      const seedMatches = this.seedData[type]
        .filter(item => !queryLower || item.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map(value => ({ value }));
      
      // Combine and dedupe (case-insensitive)
      const allSuggestions = new Map<string, Suggestion>();
      
      // Add user history first (highest priority)
      userHistory.forEach(suggestion => {
        const key = suggestion.value.toLowerCase();
        if (!allSuggestions.has(key)) {
          allSuggestions.set(key, { ...suggestion, is_user_history: true });
        }
      });
      
      // Add popular suggestions
      popularSuggestions.forEach(suggestion => {
        const key = suggestion.value.toLowerCase();
        if (!allSuggestions.has(key)) {
          allSuggestions.set(key, suggestion);
        }
      });
      
      // Add seed data
      seedMatches.forEach(suggestion => {
        const key = suggestion.value.toLowerCase();
        if (!allSuggestions.has(key)) {
          allSuggestions.set(key, suggestion);
        }
      });
      
      // Convert to array and sort (user history first, then by usage count, then alphabetically)
      const result = Array.from(allSuggestions.values())
        .sort((a, b) => {
          if (a.is_user_history && !b.is_user_history) return -1;
          if (!a.is_user_history && b.is_user_history) return 1;
          if (a.usage_count && b.usage_count) {
            return b.usage_count - a.usage_count;
          }
          return a.value.localeCompare(b.value);
        })
        .slice(0, limit);
      
      return result;
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      // Fallback to seed data only
      return this.seedData[type]
        .filter(item => !query || item.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(value => ({ value }));
    }
  }

  /**
   * Get user's history for a given type
   */
  private async getUserHistory(type: SuggestionType, userId: string): Promise<Suggestion[]> {
    try {
      let columnName: string;
      switch (type) {
        case 'skill':
          columnName = 'skills';
          break;
        case 'job_title':
          columnName = 'job_titles';
          break;
        case 'keyword':
          columnName = 'include_keywords'; // Could also check exclude_keywords
          break;
        default:
          return [];
      }

      const result = await query(
        `SELECT DISTINCT UNNEST(${columnName}) as value
         FROM apply_profiles
         WHERE user_id = $1 AND ${columnName} IS NOT NULL AND array_length(${columnName}, 1) > 0
         ORDER BY updated_at DESC
         LIMIT 50`,
        [userId]
      );

      return result.rows.map(row => ({ value: row.value }));
    } catch (error) {
      logger.error('Error getting user history:', error);
      return [];
    }
  }

  /**
   * Get popular suggestions from cache
   */
  private async getPopularSuggestions(
    type: SuggestionType,
    query: string,
    limit: number
  ): Promise<Suggestion[]> {
    try {
      let sqlQuery = `
        SELECT value, usage_count
        FROM apply_suggestions_cache
        WHERE type = $1
      `;
      const params: any[] = [type];
      
      if (query) {
        sqlQuery += ` AND LOWER(value) LIKE LOWER($${params.length + 1})`;
        params.push(`%${query}%`);
      }
      
      sqlQuery += ` ORDER BY usage_count DESC, last_used_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await query(sqlQuery, params);
      return result.rows.map((row: any) => ({
        value: row.value,
        usage_count: row.usage_count,
      }));
    } catch (error) {
      logger.error('Error getting popular suggestions:', error);
      return [];
    }
  }

  /**
   * Record usage of a suggestion (increment cache)
   */
  async recordUsage(type: SuggestionType, value: string): Promise<void> {
    try {
      await query(
        `INSERT INTO apply_suggestions_cache (type, value, usage_count, last_used_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT ON CONSTRAINT idx_apply_suggestions_cache_unique DO UPDATE SET
           usage_count = apply_suggestions_cache.usage_count + 1,
           last_used_at = NOW()`,
        [type, value]
      );
    } catch (error) {
      logger.error('Error recording suggestion usage:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Record multiple usages at once
   */
  async recordUsages(type: SuggestionType, values: string[]): Promise<void> {
    try {
      for (const value of values) {
        await this.recordUsage(type, value);
      }
    } catch (error) {
      logger.error('Error recording suggestion usages:', error);
    }
  }
}

