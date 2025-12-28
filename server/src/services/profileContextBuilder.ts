/**
 * Profile Context Builder
 * 
 * Analyzes all selected fields to build a weighted representation of user intent.
 * This context is used to rank suggestions across all fields dynamically.
 */

import { logger } from '../middlewares';

export interface ProfileContext {
  // Domain/Industry signals
  domains: Map<string, number>; // e.g., "frontend" -> 0.8, "backend" -> 0.6
  industries: Map<string, number>; // e.g., "fintech" -> 0.9, "healthcare" -> 0.3
  
  // Role/Level signals
  roles: Map<string, number>; // e.g., "developer" -> 0.9, "manager" -> 0.2
  seniority: Map<string, number>; // e.g., "senior" -> 0.8, "junior" -> 0.1
  
  // Technology/Tool signals
  technologies: Map<string, number>; // e.g., "react" -> 0.9, "python" -> 0.3
  tools: Map<string, number>; // e.g., "docker" -> 0.7, "git" -> 0.9
  
  // Environment signals
  workArrangements: Map<string, number>; // e.g., "remote" -> 0.9, "hybrid" -> 0.1
  locations: Map<string, number>; // e.g., "usa" -> 0.8, "europe" -> 0.2
  
  // Exclusion signals (what to avoid)
  exclusions: Set<string>; // Keywords/topics to downrank
  
  // Overall strength (how complete is the profile)
  strength: number; // 0-1, how much context we have
}

export class ProfileContextBuilder {
  /**
   * Build context from current profile selections
   */
  buildContext(params: {
    skills?: string[];
    jobTitles?: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
    locations?: Array<{ display_name: string; country?: string; city?: string; location_type?: string }>;
  }): ProfileContext {
    const context: ProfileContext = {
      domains: new Map(),
      industries: new Map(),
      roles: new Map(),
      seniority: new Map(),
      technologies: new Map(),
      tools: new Map(),
      workArrangements: new Map(),
      locations: new Map(),
      exclusions: new Set(),
      strength: 0,
    };

    const { skills = [], jobTitles = [], includeKeywords = [], excludeKeywords = [], locations = [] } = params;

    // Process skills
    for (const skill of skills) {
      this.processSkill(skill, context);
    }

    // Process job titles
    for (const title of jobTitles) {
      this.processJobTitle(title, context);
    }

    // Process include keywords
    for (const keyword of includeKeywords) {
      this.processKeyword(keyword, context, true);
    }

    // Process exclude keywords
    for (const keyword of excludeKeywords) {
      context.exclusions.add(this.normalize(keyword));
    }

    // Process locations
    for (const location of locations) {
      this.processLocation(location, context);
    }

    // Calculate overall strength
    context.strength = this.calculateStrength(context);

    return context;
  }

  /**
   * Process a skill to extract context signals
   */
  private processSkill(skill: string, context: ProfileContext): void {
    const normalized = this.normalize(skill);
    const lower = skill.toLowerCase();

    // Technology signals
    this.addSignal(context.technologies, normalized, 1.0);

    // Domain detection
    if (this.matchesDomain(lower, 'frontend')) {
      this.addSignal(context.domains, 'frontend', 0.8);
    }
    if (this.matchesDomain(lower, 'backend')) {
      this.addSignal(context.domains, 'backend', 0.8);
    }
    if (this.matchesDomain(lower, 'mobile')) {
      this.addSignal(context.domains, 'mobile', 0.8);
    }
    if (this.matchesDomain(lower, 'devops') || this.matchesDomain(lower, 'cloud')) {
      this.addSignal(context.domains, 'devops', 0.8);
    }
    if (this.matchesDomain(lower, 'data') || this.matchesDomain(lower, 'ml') || this.matchesDomain(lower, 'ai')) {
      this.addSignal(context.domains, 'data', 0.8);
    }
    if (this.matchesDomain(lower, 'design') || this.matchesDomain(lower, 'ui') || this.matchesDomain(lower, 'ux')) {
      this.addSignal(context.domains, 'design', 0.8);
    }

    // Industry detection from skills
    if (this.matchesIndustry(lower, 'fintech')) {
      this.addSignal(context.industries, 'fintech', 0.6);
    }
    if (this.matchesIndustry(lower, 'health')) {
      this.addSignal(context.industries, 'healthcare', 0.6);
    }
    if (this.matchesIndustry(lower, 'education') || this.matchesIndustry(lower, 'edtech')) {
      this.addSignal(context.industries, 'education', 0.6);
    }

    // Tool detection
    if (this.isTool(lower)) {
      this.addSignal(context.tools, normalized, 0.7);
    }
  }

  /**
   * Process a job title to extract context signals
   */
  private processJobTitle(title: string, context: ProfileContext): void {
    const normalized = this.normalize(title);
    const lower = title.toLowerCase();

    // Role signals
    if (lower.includes('developer') || lower.includes('engineer')) {
      this.addSignal(context.roles, 'developer', 0.9);
    }
    if (lower.includes('manager') || lower.includes('lead')) {
      this.addSignal(context.roles, 'manager', 0.8);
    }
    if (lower.includes('designer')) {
      this.addSignal(context.roles, 'designer', 0.9);
    }
    if (lower.includes('analyst') || lower.includes('scientist')) {
      this.addSignal(context.roles, 'analyst', 0.8);
    }
    if (lower.includes('architect')) {
      this.addSignal(context.roles, 'architect', 0.8);
    }

    // Seniority detection
    if (lower.includes('senior') || lower.includes('lead') || lower.includes('principal')) {
      this.addSignal(context.seniority, 'senior', 0.9);
    }
    if (lower.includes('junior') || lower.includes('entry')) {
      this.addSignal(context.seniority, 'junior', 0.9);
    }
    if (lower.includes('mid') || lower.includes('intermediate')) {
      this.addSignal(context.seniority, 'mid', 0.9);
    }

    // Domain from title
    if (lower.includes('frontend') || lower.includes('front-end')) {
      this.addSignal(context.domains, 'frontend', 0.9);
    }
    if (lower.includes('backend') || lower.includes('back-end')) {
      this.addSignal(context.domains, 'backend', 0.9);
    }
    if (lower.includes('full stack') || lower.includes('fullstack')) {
      this.addSignal(context.domains, 'frontend', 0.6);
      this.addSignal(context.domains, 'backend', 0.6);
    }
    if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) {
      this.addSignal(context.domains, 'mobile', 0.9);
    }
    if (lower.includes('devops') || lower.includes('sre') || lower.includes('cloud')) {
      this.addSignal(context.domains, 'devops', 0.9);
    }
    if (lower.includes('data') || lower.includes('ml') || lower.includes('ai')) {
      this.addSignal(context.domains, 'data', 0.9);
    }
    if (lower.includes('design') || lower.includes('ui') || lower.includes('ux')) {
      this.addSignal(context.domains, 'design', 0.9);
    }
    if (lower.includes('product')) {
      this.addSignal(context.roles, 'product', 0.8);
    }
    if (lower.includes('qa') || lower.includes('test')) {
      this.addSignal(context.domains, 'qa', 0.9);
    }
  }

  /**
   * Process a keyword to extract context signals
   */
  private processKeyword(keyword: string, context: ProfileContext, isInclude: boolean): void {
    const normalized = this.normalize(keyword);
    const lower = keyword.toLowerCase();

    // Work arrangement
    if (lower.includes('remote') || lower.includes('wfh')) {
      this.addSignal(context.workArrangements, 'remote', isInclude ? 0.9 : -0.5);
    }
    if (lower.includes('hybrid')) {
      this.addSignal(context.workArrangements, 'hybrid', isInclude ? 0.9 : -0.5);
    }
    if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('office')) {
      this.addSignal(context.workArrangements, 'onsite', isInclude ? 0.9 : -0.5);
    }

    // Industry detection
    if (lower.includes('fintech')) {
      this.addSignal(context.industries, 'fintech', isInclude ? 0.8 : -0.3);
    }
    if (lower.includes('health') || lower.includes('medical')) {
      this.addSignal(context.industries, 'healthcare', isInclude ? 0.8 : -0.3);
    }
    if (lower.includes('education') || lower.includes('edtech')) {
      this.addSignal(context.industries, 'education', isInclude ? 0.8 : -0.3);
    }
    if (lower.includes('saas')) {
      this.addSignal(context.industries, 'saas', isInclude ? 0.8 : -0.3);
    }
    if (lower.includes('ecommerce') || lower.includes('e-commerce')) {
      this.addSignal(context.industries, 'ecommerce', isInclude ? 0.8 : -0.3);
    }
  }

  /**
   * Process a location to extract context signals
   */
  private processLocation(
    location: { display_name: string; country?: string; city?: string; location_type?: string },
    context: ProfileContext
  ): void {
    const { country, city, location_type } = location;

    // Work arrangement from location type
    if (location_type === 'remote') {
      this.addSignal(context.workArrangements, 'remote', 0.9);
    } else if (location_type === 'hybrid') {
      this.addSignal(context.workArrangements, 'hybrid', 0.9);
    } else {
      this.addSignal(context.workArrangements, 'onsite', 0.9);
    }

    // Geographic signals
    if (country) {
      const countryNorm = this.normalize(country);
      this.addSignal(context.locations, countryNorm, 0.7);
      
      // Regional grouping
      if (this.isNorthAmerica(country)) {
        this.addSignal(context.locations, 'north_america', 0.5);
      }
      if (this.isEurope(country)) {
        this.addSignal(context.locations, 'europe', 0.5);
      }
      if (this.isAsia(country)) {
        this.addSignal(context.locations, 'asia', 0.5);
      }
    }

    if (city) {
      const cityNorm = this.normalize(city);
      this.addSignal(context.locations, cityNorm, 0.5);
    }
  }

  /**
   * Add or update a signal in a map
   */
  private addSignal(map: Map<string, number>, key: string, value: number): void {
    const current = map.get(key) || 0;
    map.set(key, Math.min(1.0, Math.max(-1.0, current + value)));
  }

  /**
   * Calculate overall context strength
   */
  private calculateStrength(context: ProfileContext): number {
    let totalSignals = 0;
    let weightedSum = 0;

    // Count signals from each category
    const categories = [
      context.domains,
      context.industries,
      context.roles,
      context.technologies,
      context.tools,
    ];

    for (const category of categories) {
      for (const value of category.values()) {
        totalSignals++;
        weightedSum += Math.abs(value);
      }
    }

    // Normalize to 0-1
    if (totalSignals === 0) return 0;
    return Math.min(1.0, weightedSum / (totalSignals * 2));
  }

  /**
   * Normalize a string for matching
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Check if skill matches a domain
   */
  private matchesDomain(lower: string, domain: string): boolean {
    const patterns: Record<string, string[]> = {
      frontend: ['frontend', 'front-end', 'react', 'vue', 'angular', 'svelte', 'html', 'css', 'javascript', 'typescript'],
      backend: ['backend', 'back-end', 'node', 'express', 'django', 'flask', 'spring', 'api', 'server'],
      mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
      devops: ['devops', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ci/cd'],
      data: ['data', 'ml', 'machine learning', 'ai', 'python', 'pandas', 'tensorflow', 'pytorch', 'sql'],
      design: ['design', 'ui', 'ux', 'figma', 'sketch', 'wireframe', 'prototype'],
    };
    return patterns[domain]?.some(pattern => lower.includes(pattern)) || false;
  }

  /**
   * Check if text matches an industry
   */
  private matchesIndustry(lower: string, industry: string): boolean {
    const patterns: Record<string, string[]> = {
      fintech: ['fintech', 'finance', 'banking', 'payment', 'crypto'],
      healthcare: ['health', 'medical', 'hipaa', 'hl7', 'fhir'],
      education: ['education', 'edtech', 'lms', 'learning'],
    };
    return patterns[industry]?.some(pattern => lower.includes(pattern)) || false;
  }

  /**
   * Check if skill is a tool
   */
  private isTool(lower: string): boolean {
    const tools = ['git', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'jira', 'confluence'];
    return tools.some(tool => lower.includes(tool));
  }

  /**
   * Check if country is in North America
   */
  private isNorthAmerica(country: string): boolean {
    const na = ['united states', 'usa', 'us', 'canada', 'mexico'];
    return na.some(c => country.toLowerCase().includes(c));
  }

  /**
   * Check if country is in Europe
   */
  private isEurope(country: string): boolean {
    const eu = ['united kingdom', 'uk', 'germany', 'france', 'spain', 'italy', 'netherlands', 'poland', 'sweden', 'norway', 'denmark'];
    return eu.some(c => country.toLowerCase().includes(c));
  }

  /**
   * Check if country is in Asia
   */
  private isAsia(country: string): boolean {
    const asia = ['india', 'china', 'japan', 'singapore', 'south korea', 'australia', 'new zealand'];
    return asia.some(c => country.toLowerCase().includes(c));
  }
}

export const contextBuilder = new ProfileContextBuilder();

