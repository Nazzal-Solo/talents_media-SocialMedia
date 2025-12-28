/**
 * Generic Suggestion Engine
 * 
 * Unified ranking algorithm that works for all field types.
 * Uses profile context to dynamically adapt suggestions.
 */

import { ProfileContext, contextBuilder } from './profileContextBuilder';
import { fuzzyMatch, normalizeText, getCanonical } from './fuzzyMatcher';
import { logger } from '../middlewares';
import * as fs from 'fs';
import * as path from 'path';

export type FieldType = 'skill' | 'job_title' | 'keyword' | 'location';

export interface SuggestionCandidate {
  value: string;
  normalizedKey: string;
  category?: string;
  popularityScore?: number;
  aliases?: string[];
}

export interface RankedSuggestion {
  value: string;
  score: number;
  matchScore: number;
  contextScore: number;
  relationshipScore: number;
  popularityScore: number;
  category?: string;
  isRecommended?: boolean;
}

interface RelationshipGraph {
  skillToSkill: Map<string, Set<string>>;
  titleToTitle: Map<string, Set<string>>;
  keywordToKeyword: Map<string, Set<string>>;
  skillToTitle: Map<string, Set<string>>;
  titleToSkill: Map<string, Set<string>>;
  skillToKeyword: Map<string, Set<string>>;
  keywordToSkill: Map<string, Set<string>>;
  titleToKeyword: Map<string, Set<string>>;
  keywordToTitle: Map<string, Set<string>>;
}

export class GenericSuggestionEngine {
  private datasets: {
    skills: SuggestionCandidate[];
    jobTitles: SuggestionCandidate[];
    keywords: SuggestionCandidate[];
  } | null = null;

  private relationshipGraph: RelationshipGraph | null = null;
  private indexes: Map<FieldType, Map<string, SuggestionCandidate[]>> = new Map();
  private cache: Map<string, RankedSuggestion[]> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadDatasets();
    this.buildRelationshipGraph();
    this.buildIndexes();
  }

  /**
   * Load datasets from JSON
   */
  private loadDatasets(): void {
    try {
      const dataPath = path.join(__dirname, '../../data/apply-datasets.json');
      if (!fs.existsSync(dataPath)) {
        logger.warn('Dataset file not found');
        return;
      }

      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Normalize dataset structure - handle both old and new formats
      const normalizeCandidates = (items: any[]): SuggestionCandidate[] => {
        return items
          .filter(item => item && (item.value || item.displayName))
          .map(item => ({
            value: item.value || item.displayName,
            normalizedKey: item.normalizedKey || normalizeText(item.value || item.displayName),
            category: item.category,
            popularityScore: item.popularityScore || 1,
            aliases: item.aliases || [],
          }));
      };

      this.datasets = {
        skills: normalizeCandidates(data.skills || []),
        jobTitles: normalizeCandidates(data.jobTitles || []),
        keywords: normalizeCandidates(data.keywords || []),
      };

      logger.info(`✅ Loaded datasets: ${this.datasets.skills.length} skills, ${this.datasets.jobTitles.length} titles, ${this.datasets.keywords.length} keywords`);
    } catch (error: any) {
      logger.error('Error loading datasets:', error);
    }
  }

  /**
   * Build comprehensive relationship graph
   */
  private buildRelationshipGraph(): void {
    if (!this.datasets) return;

    const graph: RelationshipGraph = {
      skillToSkill: new Map(),
      titleToTitle: new Map(),
      keywordToKeyword: new Map(),
      skillToTitle: new Map(),
      titleToSkill: new Map(),
      skillToKeyword: new Map(),
      keywordToSkill: new Map(),
      titleToKeyword: new Map(),
      keywordToTitle: new Map(),
    };

    // Build skill-to-skill relationships from dataset
    if (this.datasets.skills.length > 0) {
      const skillRelationships = this.loadSkillRelationships();
      for (const [skill, related] of Object.entries(skillRelationships)) {
        graph.skillToSkill.set(skill, new Set(related));
      }
    }

    // Build category-based relationships
    this.buildCategoryRelationships(graph);

    // Build title-to-skill mappings
    this.buildTitleSkillMappings(graph);

    // Build keyword relationships
    this.buildKeywordRelationships(graph);

    this.relationshipGraph = graph;
    logger.info('✅ Built comprehensive relationship graph');
  }

  /**
   * Load skill relationships from dataset
   */
  private loadSkillRelationships(): Record<string, string[]> {
    try {
      const dataPath = path.join(__dirname, '../../data/apply-datasets.json');
      if (!fs.existsSync(dataPath)) return {};

      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(fileContent);
      return data.skillRelationships || {};
    } catch {
      return {};
    }
  }

  /**
   * Build category-based relationships
   */
  private buildCategoryRelationships(graph: RelationshipGraph): void {
    if (!this.datasets) return;

    // Group skills by category
    const categoryGroups: Map<string, string[]> = new Map();
    for (const skill of this.datasets.skills) {
      if (skill.category) {
        if (!categoryGroups.has(skill.category)) {
          categoryGroups.set(skill.category, []);
        }
        categoryGroups.get(skill.category)!.push(skill.normalizedKey);
      }
    }

    // Create relationships within categories
    for (const [category, skills] of categoryGroups.entries()) {
      for (let i = 0; i < skills.length; i++) {
        for (let j = i + 1; j < Math.min(i + 6, skills.length); j++) {
          // Connect each skill to up to 5 others in same category
          if (!graph.skillToSkill.has(skills[i])) {
            graph.skillToSkill.set(skills[i], new Set());
          }
          graph.skillToSkill.get(skills[i])!.add(skills[j]);

          if (!graph.skillToSkill.has(skills[j])) {
            graph.skillToSkill.set(skills[j], new Set());
          }
          graph.skillToSkill.get(skills[j])!.add(skills[i]);
        }
      }
    }
  }

  /**
   * Build title-to-skill mappings
   */
  private buildTitleSkillMappings(graph: RelationshipGraph): void {
    if (!this.datasets) return;

    // Load from dataset
    try {
      const dataPath = path.join(__dirname, '../../data/apply-datasets.json');
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const data = JSON.parse(fileContent);
        const titleSkillMap = data.jobTitleSkillMap || {};

        for (const [title, skills] of Object.entries(titleSkillMap)) {
          const titleNorm = normalizeText(title);
          if (!graph.titleToSkill.has(titleNorm)) {
            graph.titleToSkill.set(titleNorm, new Set());
          }
          for (const skill of skills as string[]) {
            const skillNorm = normalizeText(skill);
            graph.titleToSkill.get(titleNorm)!.add(skillNorm);

            // Reverse mapping
            if (!graph.skillToTitle.has(skillNorm)) {
              graph.skillToTitle.set(skillNorm, new Set());
            }
            graph.skillToTitle.get(skillNorm)!.add(titleNorm);
          }
        }
      }
    } catch (error) {
      logger.error('Error loading title-skill mappings:', error);
    }
  }

  /**
   * Build keyword relationships
   */
  private buildKeywordRelationships(graph: RelationshipGraph): void {
    if (!this.datasets) return;

    // Group keywords by category
    const categoryGroups: Map<string, string[]> = new Map();
    for (const keyword of this.datasets.keywords) {
      if (keyword.category) {
        if (!categoryGroups.has(keyword.category)) {
          categoryGroups.set(keyword.category, []);
        }
        categoryGroups.get(keyword.category)!.push(keyword.normalizedKey);
      }
    }

    // Create relationships within keyword categories
    for (const [category, keywords] of categoryGroups.entries()) {
      for (let i = 0; i < keywords.length; i++) {
        for (let j = i + 1; j < keywords.length; j++) {
          if (!graph.keywordToKeyword.has(keywords[i])) {
            graph.keywordToKeyword.set(keywords[i], new Set());
          }
          graph.keywordToKeyword.get(keywords[i])!.add(keywords[j]);

          if (!graph.keywordToKeyword.has(keywords[j])) {
            graph.keywordToKeyword.set(keywords[j], new Set());
          }
          graph.keywordToKeyword.get(keywords[j])!.add(keywords[i]);
        }
      }
    }

    // Connect keywords to skills/titles based on industry/domain
    this.buildCrossFieldRelationships(graph);
  }

  /**
   * Build cross-field relationships (skill↔keyword, title↔keyword)
   */
  private buildCrossFieldRelationships(graph: RelationshipGraph): void {
    if (!this.datasets) return;

    // Industry keywords -> related skills/titles
    const industryKeywords = ['fintech', 'healthtech', 'edtech', 'saas', 'ecommerce'];
    const industrySkills: Record<string, string[]> = {
      fintech: ['payment', 'banking', 'crypto', 'blockchain', 'security'],
      healthtech: ['health', 'medical', 'hipaa', 'hl7', 'fhir'],
      edtech: ['education', 'lms', 'learning', 'teaching'],
      saas: ['cloud', 'api', 'microservices', 'scalability'],
      ecommerce: ['shopify', 'woocommerce', 'payment', 'inventory'],
    };

    for (const keyword of industryKeywords) {
      const keywordNorm = normalizeText(keyword);
      const skills = industrySkills[keyword] || [];

      for (const skill of skills) {
        const skillNorm = normalizeText(skill);
        
        // Keyword -> Skill
        if (!graph.keywordToSkill.has(keywordNorm)) {
          graph.keywordToSkill.set(keywordNorm, new Set());
        }
        graph.keywordToSkill.get(keywordNorm)!.add(skillNorm);

        // Skill -> Keyword
        if (!graph.skillToKeyword.has(skillNorm)) {
          graph.skillToKeyword.set(skillNorm, new Set());
        }
        graph.skillToKeyword.get(skillNorm)!.add(keywordNorm);
      }
    }
  }

  /**
   * Build search indexes for fast lookup
   */
  private buildIndexes(): void {
    if (!this.datasets) return;

    const types: FieldType[] = ['skill', 'job_title', 'keyword'];
    for (const type of types) {
      const index = new Map<string, SuggestionCandidate[]>();
      const candidates = this.getCandidatesForType(type);

      // Index by normalized key
      for (const candidate of candidates) {
        if (!candidate || !candidate.normalizedKey) continue;
        const key = candidate.normalizedKey;
        if (!index.has(key)) {
          index.set(key, []);
        }
        index.get(key)!.push(candidate);
      }

      // Index by words for partial matching
      for (const candidate of candidates) {
        if (!candidate || !candidate.value) continue;
        
        const value = candidate.value;
        if (typeof value !== 'string') continue;
        
        const words = value.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length >= 2) {
            if (!index.has(word)) {
              index.set(word, []);
            }
            index.get(word)!.push(candidate);
          }
        }

        // Also index aliases
        if (candidate.aliases && Array.isArray(candidate.aliases) && candidate.aliases.length > 0) {
          for (const alias of candidate.aliases) {
            if (typeof alias !== 'string') continue;
            const aliasNorm = normalizeText(alias);
            if (aliasNorm) {
              if (!index.has(aliasNorm)) {
                index.set(aliasNorm, []);
              }
              index.get(aliasNorm)!.push(candidate);
            }
          }
        }
      }

      this.indexes.set(type, index);
    }

    logger.info(`✅ Built indexes for ${types.length} field types`);
  }

  /**
   * Get candidates for a field type
   */
  private getCandidatesForType(type: FieldType): SuggestionCandidate[] {
    if (!this.datasets) return [];

    switch (type) {
      case 'skill':
        return this.datasets.skills;
      case 'job_title':
        return this.datasets.jobTitles;
      case 'keyword':
        return this.datasets.keywords;
      default:
        return [];
    }
  }

  /**
   * Get suggestions for a field with context-aware ranking
   */
  getSuggestions(
    fieldType: FieldType,
    query: string = '',
    context: ProfileContext,
    selectedValues: string[] = [],
    limit: number = 20
  ): RankedSuggestion[] {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(fieldType, query, context, selectedValues);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < this.CACHE_TTL) {
      return (cached as any).results;
    }

    // Get candidates
    const candidates = this.getCandidatesForType(fieldType);

    // Fast candidate retrieval using index
    const filteredCandidates = this.filterCandidates(candidates, query, limit * 3, fieldType);

    // Rank candidates
    const ranked = filteredCandidates
      .map(candidate => this.rankCandidate(candidate, query, context, selectedValues, fieldType))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache results
    this.cache.set(cacheKey, { results: ranked, timestamp: Date.now() } as any);

    // Clean old cache entries periodically (keep cache size reasonable)
    if (this.cache.size > 500) {
      const now = Date.now();
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (now - (entry as any).timestamp > this.CACHE_TTL) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    }

    const duration = Date.now() - startTime;
    if (duration > 300) {
      logger.warn(`Slow suggestion query: ${duration}ms for ${fieldType}`);
    }

    return ranked;
  }

  /**
   * Filter candidates using index for fast retrieval
   */
  private filterCandidates(candidates: SuggestionCandidate[], query: string, limit: number, fieldType: FieldType): SuggestionCandidate[] {
    if (!query) {
      // Return top candidates by popularity when no query
      return candidates
        .sort((a, b) => (b.popularityScore || 1) - (a.popularityScore || 1))
        .slice(0, limit);
    }

    const queryNorm = normalizeText(query);
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length >= 2);
    const seen = new Set<string>();

    // Try index lookup first
    const index = this.indexes.get(fieldType);
    if (index && queryWords.length > 0) {
      const indexedResults: SuggestionCandidate[] = [];
      for (const word of queryWords) {
        const matches = index.get(word) || [];
        for (const match of matches) {
          if (!seen.has(match.normalizedKey)) {
            seen.add(match.normalizedKey);
            indexedResults.push(match);
          }
        }
      }
      if (indexedResults.length > 0) {
        return indexedResults.slice(0, limit * 2); // Get more for ranking
      }
    }

    // Fallback to fuzzy matching with early termination
    const results: Array<{ candidate: SuggestionCandidate; score: number }> = [];
    for (const candidate of candidates) {
      if (results.length >= limit * 3) break; // Early termination
      const match = fuzzyMatch(query, candidate.value);
      if (match.score > 0.3) {
        results.push({ candidate, score: match.score });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.candidate)
      .slice(0, limit * 2);
  }

  /**
   * Rank a single candidate
   */
  private rankCandidate(
    candidate: SuggestionCandidate,
    query: string,
    context: ProfileContext,
    selectedValues: string[],
    fieldType: FieldType
  ): RankedSuggestion {
    // Validate candidate
    if (!candidate || !candidate.value || typeof candidate.value !== 'string') {
      return {
        value: '',
        score: 0,
        matchScore: 0,
        contextScore: 0,
        relationshipScore: 0,
        popularityScore: 0,
      };
    }

    // Text match score
    const matchResult = fuzzyMatch(query, candidate.value);
    const matchScore = matchResult.score;

    // Context relevance score
    const contextScore = this.calculateContextScore(candidate, context, fieldType);

    // Relationship score
    const relationshipScore = this.calculateRelationshipScore(
      candidate,
      context,
      fieldType
    );

    // Popularity score
    const popularityScore = (candidate.popularityScore || 1) / 10;

    // Combined score with weights
    let score =
      matchScore * 0.4 + // Text match is important
      contextScore * 0.35 + // Context relevance
      relationshipScore * 0.2 + // Relationships
      popularityScore * 0.05; // Popularity

    // Penalties
    const candidateNorm = candidate.normalizedKey;
    if (selectedValues.some(v => normalizeText(v) === candidateNorm)) {
      score = 0; // Already selected
    }

    // Check exclusions
    for (const exclusion of context.exclusions) {
      if (candidateNorm.includes(exclusion) || exclusion.includes(candidateNorm)) {
        score *= 0.1; // Heavy penalty
      }
    }

    return {
      value: candidate.value,
      score: Math.max(0, Math.min(1, score)),
      matchScore,
      contextScore,
      relationshipScore,
      popularityScore,
      category: candidate.category,
      isRecommended: contextScore > 0.5 || relationshipScore > 0.5,
    };
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextScore(
    candidate: SuggestionCandidate,
    context: ProfileContext,
    fieldType: FieldType
  ): number {
    if (!candidate || !candidate.value || typeof candidate.value !== 'string') {
      return 0;
    }

    let score = 0;
    const candidateNorm = candidate.normalizedKey || normalizeText(candidate.value);
    const candidateLower = candidate.value.toLowerCase();

    // Check domain alignment
    for (const [domain, weight] of context.domains.entries()) {
      if (this.matchesDomain(candidateLower, domain)) {
        score += weight * 0.3;
      }
    }

    // Check industry alignment
    for (const [industry, weight] of context.industries.entries()) {
      if (this.matchesIndustry(candidateLower, industry)) {
        score += weight * 0.2;
      }
    }

    // Check role alignment (for titles)
    if (fieldType === 'job_title') {
      for (const [role, weight] of context.roles.entries()) {
        if (candidateLower.includes(role)) {
          score += weight * 0.3;
        }
      }
    }

    // Check technology alignment (for skills)
    if (fieldType === 'skill') {
      for (const [tech, weight] of context.technologies.entries()) {
        if (candidateNorm === tech || candidateNorm.includes(tech) || tech.includes(candidateNorm)) {
          score += weight * 0.4;
        }
      }
    }

    // Check work arrangement (for keywords)
    if (fieldType === 'keyword') {
      for (const [arrangement, weight] of context.workArrangements.entries()) {
        if (candidateLower.includes(arrangement)) {
          score += weight * 0.3;
        }
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate relationship score
   */
  private calculateRelationshipScore(
    candidate: SuggestionCandidate,
    context: ProfileContext,
    fieldType: FieldType
  ): number {
    if (!this.relationshipGraph) return 0;

    let score = 0;
    const candidateNorm = candidate.normalizedKey;
    const graph = this.relationshipGraph;

    // Check relationships with selected skills
    for (const tech of context.technologies.keys()) {
      if (fieldType === 'skill' && graph.skillToSkill.has(tech)) {
        if (graph.skillToSkill.get(tech)!.has(candidateNorm)) {
          score += 0.3;
        }
      }
      if (fieldType === 'job_title' && graph.skillToTitle.has(tech)) {
        if (graph.skillToTitle.get(tech)!.has(candidateNorm)) {
          score += 0.4;
        }
      }
      if (fieldType === 'keyword' && graph.skillToKeyword.has(tech)) {
        if (graph.skillToKeyword.get(tech)!.has(candidateNorm)) {
          score += 0.3;
        }
      }
    }

    // Check relationships with selected titles
    for (const role of context.roles.keys()) {
      const roleNorm = normalizeText(role);
      if (fieldType === 'skill' && graph.titleToSkill.has(roleNorm)) {
        if (graph.titleToSkill.get(roleNorm)!.has(candidateNorm)) {
          score += 0.4;
        }
      }
      if (fieldType === 'keyword' && graph.titleToKeyword.has(roleNorm)) {
        if (graph.titleToKeyword.get(roleNorm)!.has(candidateNorm)) {
          score += 0.3;
        }
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Check if candidate matches a domain
   */
  private matchesDomain(lower: string, domain: string): boolean {
    const patterns: Record<string, string[]> = {
      frontend: ['frontend', 'react', 'vue', 'angular', 'html', 'css'],
      backend: ['backend', 'node', 'api', 'server'],
      mobile: ['mobile', 'ios', 'android'],
      devops: ['devops', 'docker', 'kubernetes', 'aws'],
      data: ['data', 'ml', 'ai', 'python'],
      design: ['design', 'ui', 'ux', 'figma'],
    };
    return patterns[domain]?.some(pattern => lower.includes(pattern)) || false;
  }

  /**
   * Check if candidate matches an industry
   */
  private matchesIndustry(lower: string, industry: string): boolean {
    const patterns: Record<string, string[]> = {
      fintech: ['fintech', 'finance', 'banking'],
      healthcare: ['health', 'medical'],
      education: ['education', 'edtech'],
    };
    return patterns[industry]?.some(pattern => lower.includes(pattern)) || false;
  }

  /**
   * Get cache key
   */
  private getCacheKey(
    fieldType: FieldType,
    query: string,
    context: ProfileContext,
    selectedValues: string[]
  ): string {
    const contextHash = context.strength.toFixed(2);
    return `${fieldType}:${normalizeText(query)}:${contextHash}:${selectedValues.join(',')}`;
  }
}

export const suggestionEngine = new GenericSuggestionEngine();

