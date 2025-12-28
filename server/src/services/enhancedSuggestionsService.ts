/**
 * Enhanced Suggestions Service
 * 
 * Implements smart, contextual suggestions with:
 * - Large dataset support (10k+ skills)
 * - Related suggestions based on selected items
 * - Job title to skill mappings
 * - Category-based and bundle-based recommendations
 * - Fast search with ranking
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../middlewares';
import { query } from '../models/db';

export type SuggestionType = 'skill' | 'job_title' | 'keyword' | 'location';

export interface Suggestion {
  value: string;
  usage_count?: number;
  is_user_history?: boolean;
  is_recommended?: boolean;
  match_score?: number;
  category?: string;
}

interface SkillItem {
  id: string;
  displayName: string;
  normalizedKey: string;
  aliases: string[];
  category?: string;
  popularityScore?: number;
  relatedSkills?: string[];
}

interface JobTitleItem {
  id: string;
  displayName: string;
  normalizedKey: string;
  aliases: string[];
  seniority?: string;
  industry?: string;
  recommendedSkills?: string[];
}

interface KeywordItem {
  id: string;
  displayName: string;
  normalizedKey: string;
  aliases: string[];
  category?: string;
}

interface DatasetData {
  skills: SkillItem[];
  jobTitles: JobTitleItem[];
  keywords: KeywordItem[];
  skillRelationships: Record<string, string[]>;
  jobTitleSkillMap: Record<string, string[]>;
  skillBundles: Record<string, string[]>;
}

interface CacheEntry {
  matches: Suggestion[];
  recommended: Suggestion[];
  timestamp: number;
}

export class EnhancedSuggestionsService {
  private datasets: DatasetData | null = null;
  private skillIndex: Map<string, SkillItem> = new Map();
  private jobTitleIndex: Map<string, JobTitleItem> = new Map();
  private keywordIndex: Map<string, KeywordItem> = new Map();
  private normalizedIndex: Map<string, string> = new Map(); // normalized -> displayName
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadDatasets();
  }

  /**
   * Load datasets from JSON file
   */
  private loadDatasets(): void {
    try {
      const dataPath = path.join(__dirname, '../../data/apply-datasets.json');
      
      if (!fs.existsSync(dataPath)) {
        logger.warn('Dataset file not found, using fallback seed data');
        return;
      }

      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      this.datasets = JSON.parse(fileContent) as DatasetData;

      // Build indexes for fast lookup
      for (const skill of this.datasets.skills) {
        this.skillIndex.set(skill.normalizedKey, skill);
        this.normalizedIndex.set(skill.normalizedKey, skill.displayName);
        // Also index by display name
        this.normalizedIndex.set(this.normalizeKey(skill.displayName), skill.displayName);
      }

      for (const jobTitle of this.datasets.jobTitles) {
        this.jobTitleIndex.set(jobTitle.normalizedKey, jobTitle);
        this.normalizedIndex.set(jobTitle.normalizedKey, jobTitle.displayName);
      }

      for (const keyword of this.datasets.keywords) {
        this.keywordIndex.set(keyword.normalizedKey, keyword);
        this.normalizedIndex.set(keyword.normalizedKey, keyword.displayName);
      }

      logger.info(`✅ Loaded datasets: ${this.datasets.skills.length} skills, ${this.datasets.jobTitles.length} job titles, ${this.datasets.keywords.length} keywords`);
    } catch (error: any) {
      logger.error('Error loading datasets:', error);
      this.datasets = null;
    }
  }

  /**
   * Normalize a string for matching
   */
  private normalizeKey(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Calculate match score for a suggestion
   */
  private calculateMatchScore(
    item: { displayName: string; normalizedKey: string; category?: string; popularityScore?: number },
    query: string,
    selectedItems: string[],
    selectedJobTitles: string[] = []
  ): number {
    const queryLower = query.toLowerCase();
    const itemLower = item.displayName.toLowerCase();
    const normalizedQuery = this.normalizeKey(query);
    const normalizedItem = item.normalizedKey;

    let score = 0;

    // Exact match (highest priority)
    if (itemLower === queryLower) {
      score += 1000;
    }
    // Starts with query
    else if (itemLower.startsWith(queryLower)) {
      score += 500;
    }
    // Contains query
    else if (itemLower.includes(queryLower)) {
      score += 200;
    }
    // Normalized key match
    else if (normalizedItem.includes(normalizedQuery)) {
      score += 100;
    }

    // Boost if related to selected items
    if (selectedItems.length > 0) {
      const selectedNormalized = selectedItems.map(s => this.normalizeKey(s));
      const itemNormalized = normalizedItem;
      
      // Check if this item is related to any selected item
      if (this.datasets?.skillRelationships) {
        for (const selected of selectedNormalized) {
          const related = this.datasets.skillRelationships[selected] || [];
          if (related.includes(itemNormalized)) {
            score += 300; // Boost for related items
            break;
          }
        }
      }
    }

    // Boost if matches job title recommended skills
    if (selectedJobTitles.length > 0 && this.datasets?.jobTitleSkillMap) {
      for (const jobTitle of selectedJobTitles) {
        const jobNormalized = this.normalizeKey(jobTitle);
        const recommendedSkills = this.datasets.jobTitleSkillMap[jobNormalized] || [];
        if (recommendedSkills.includes(normalizedItem)) {
          score += 250; // Boost for job title recommendations
          break;
        }
      }
    }

    // Popularity boost
    if (item.popularityScore) {
      score += item.popularityScore * 10;
    }

    return score;
  }

  /**
   * Get related suggestions based on selected items
   */
  private getRelatedSuggestions(
    type: SuggestionType,
    selectedItems: string[],
    selectedJobTitles: string[] = [],
    limit: number = 8
  ): Suggestion[] {
    if (type !== 'skill' || !this.datasets || selectedItems.length === 0) {
      return [];
    }

    const related: Set<string> = new Set();
    const selectedNormalized = selectedItems.map(s => this.normalizeKey(s));

    // Get related skills from relationship graph
    if (this.datasets?.skillRelationships) {
      for (const selected of selectedNormalized) {
        const relatedSkills = this.datasets.skillRelationships[selected] || [];
        for (const relatedKey of relatedSkills) {
          const skill = this.skillIndex.get(relatedKey);
          if (skill && !selectedNormalized.includes(relatedKey)) {
            related.add(skill.displayName);
          }
        }
      }
    }

    // Get skills from job title mappings
    if (selectedJobTitles.length > 0 && this.datasets?.jobTitleSkillMap) {
      for (const jobTitle of selectedJobTitles) {
        const jobNormalized = this.normalizeKey(jobTitle);
        const recommendedSkills = this.datasets.jobTitleSkillMap[jobNormalized] || [];
        for (const skillKey of recommendedSkills) {
          const skill = this.skillIndex.get(skillKey);
          if (skill && !selectedNormalized.includes(skillKey)) {
            related.add(skill.displayName);
          }
        }
      }
    }

    // Convert to suggestions
    return Array.from(related)
      .slice(0, limit)
      .map(value => ({
        value,
        is_recommended: true,
        category: this.skillIndex.get(this.normalizeKey(value))?.category,
      }));
  }

  /**
   * Get cache key for suggestions
   */
  private getCacheKey(
    type: SuggestionType,
    query: string,
    selectedItems: string[],
    selectedJobTitles: string[]
  ): string {
    return `${type}:${query}:${selectedItems.join(',')}:${selectedJobTitles.join(',')}`;
  }

  /**
   * Get suggestions with smart ranking
   */
  async getSuggestions(
    type: SuggestionType,
    userId: string,
    query: string = '',
    limit: number = 20,
    selectedItems: string[] = [],
    selectedJobTitles: string[] = []
  ): Promise<{ matches: Suggestion[]; recommended: Suggestion[] }> {
    try {
      // Check cache
      const cacheKey = this.getCacheKey(type, query, selectedItems, selectedJobTitles);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return {
          matches: cached.matches.slice(0, limit),
          recommended: cached.recommended,
        };
      }

      const queryLower = query.toLowerCase().trim();
      
      // Get user history
      const userHistory = await this.getUserHistory(type, userId);
      const userHistorySet = new Set(userHistory.map(h => h.value.toLowerCase()));

      // Get dataset items
      let datasetItems: Array<{ displayName: string; normalizedKey: string; category?: string; popularityScore?: number }> = [];
      
      if (this.datasets) {
        switch (type) {
          case 'skill':
            datasetItems = this.datasets.skills || [];
            break;
          case 'job_title':
            datasetItems = this.datasets.jobTitles || [];
            break;
          case 'keyword':
            datasetItems = this.datasets.keywords || [];
            break;
        }
      }
      
      // If no datasets loaded, return empty results
      if (datasetItems.length === 0) {
        logger.warn(`No dataset items found for type: ${type}`);
        return { matches: [], recommended: [] };
      }

      // Filter and score matches
      const matches: Suggestion[] = [];
      const selectedNormalized = selectedItems.map(s => this.normalizeKey(s));

      for (const item of datasetItems) {
        // Skip if already selected
        if (selectedNormalized.includes(item.normalizedKey)) {
          continue;
        }

        // Filter by query if provided
        if (queryLower) {
          const itemLower = item.displayName.toLowerCase();
          const normalizedItem = item.normalizedKey;
          const normalizedQuery = this.normalizeKey(query);
          
          if (!itemLower.includes(queryLower) && !normalizedItem.includes(normalizedQuery)) {
            continue;
          }
        }

        // Calculate match score
        const matchScore = this.calculateMatchScore(
          item,
          queryLower,
          selectedItems,
          selectedJobTitles
        );

        if (matchScore > 0 || !queryLower) {
          matches.push({
            value: item.displayName,
            match_score: matchScore,
            category: item.category,
            is_user_history: userHistorySet.has(item.displayName.toLowerCase()),
            usage_count: userHistorySet.has(item.displayName.toLowerCase()) ? 1 : undefined,
          });
        }
      }

      // Sort matches by score
      matches.sort((a, b) => {
        // User history first
        if (a.is_user_history && !b.is_user_history) return -1;
        if (!a.is_user_history && b.is_user_history) return 1;
        // Then by match score
        const scoreA = a.match_score || 0;
        const scoreB = b.match_score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        // Then alphabetically
        return a.value.localeCompare(b.value);
      });

      // Get related recommendations
      const recommended = this.getRelatedSuggestions(
        type,
        selectedItems,
        selectedJobTitles,
        8
      );

      // Limit results
      const limitedMatches = matches.slice(0, limit);
      const limitedRecommended = recommended.slice(0, 8);

      // Cache results
      this.cache.set(cacheKey, {
        matches: limitedMatches,
        recommended: limitedRecommended,
        timestamp: Date.now(),
      });

      // Clean old cache entries (keep cache size reasonable)
      if (this.cache.size > 1000) {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
          if (now - entry.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
          }
        }
      }

      return {
        matches: limitedMatches,
        recommended: limitedRecommended,
      };
    } catch (error: any) {
      logger.error('Error getting suggestions:', error);
      return { matches: [], recommended: [] };
    }
  }

  /**
   * Get user's history
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
          columnName = 'include_keywords';
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
   * Record usage of a suggestion
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
    }
  }
}

