"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplySuggestionsService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class ApplySuggestionsService {
    constructor() {
        this.seedData = {
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
            location: []
        };
    }
    async getSuggestions(type, userId, query = '', limit = 20) {
        try {
            const queryLower = query.toLowerCase().trim();
            const userHistory = await this.getUserHistory(type, userId);
            const popularSuggestions = await this.getPopularSuggestions(type, queryLower, limit);
            const seedMatches = this.seedData[type]
                .filter(item => !queryLower || item.toLowerCase().includes(queryLower))
                .slice(0, limit)
                .map(value => ({ value }));
            const allSuggestions = new Map();
            userHistory.forEach(suggestion => {
                const key = suggestion.value.toLowerCase();
                if (!allSuggestions.has(key)) {
                    allSuggestions.set(key, { ...suggestion, is_user_history: true });
                }
            });
            popularSuggestions.forEach(suggestion => {
                const key = suggestion.value.toLowerCase();
                if (!allSuggestions.has(key)) {
                    allSuggestions.set(key, suggestion);
                }
            });
            seedMatches.forEach(suggestion => {
                const key = suggestion.value.toLowerCase();
                if (!allSuggestions.has(key)) {
                    allSuggestions.set(key, suggestion);
                }
            });
            const result = Array.from(allSuggestions.values())
                .sort((a, b) => {
                if (a.is_user_history && !b.is_user_history)
                    return -1;
                if (!a.is_user_history && b.is_user_history)
                    return 1;
                if (a.usage_count && b.usage_count) {
                    return b.usage_count - a.usage_count;
                }
                return a.value.localeCompare(b.value);
            })
                .slice(0, limit);
            return result;
        }
        catch (error) {
            middlewares_1.logger.error('Error getting suggestions:', error);
            return this.seedData[type]
                .filter(item => !query || item.toLowerCase().includes(query.toLowerCase()))
                .slice(0, limit)
                .map(value => ({ value }));
        }
    }
    async getUserHistory(type, userId) {
        try {
            let columnName;
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
            const result = await (0, db_1.query)(`SELECT DISTINCT UNNEST(${columnName}) as value
         FROM apply_profiles
         WHERE user_id = $1 AND ${columnName} IS NOT NULL AND array_length(${columnName}, 1) > 0
         ORDER BY updated_at DESC
         LIMIT 50`, [userId]);
            return result.rows.map(row => ({ value: row.value }));
        }
        catch (error) {
            middlewares_1.logger.error('Error getting user history:', error);
            return [];
        }
    }
    async getPopularSuggestions(type, query, limit) {
        try {
            let sqlQuery = `
        SELECT value, usage_count
        FROM apply_suggestions_cache
        WHERE type = $1
      `;
            const params = [type];
            if (query) {
                sqlQuery += ` AND LOWER(value) LIKE LOWER($${params.length + 1})`;
                params.push(`%${query}%`);
            }
            sqlQuery += ` ORDER BY usage_count DESC, last_used_at DESC LIMIT $${params.length + 1}`;
            params.push(limit);
            const result = await query(sqlQuery, params);
            return result.rows.map((row) => ({
                value: row.value,
                usage_count: row.usage_count,
            }));
        }
        catch (error) {
            middlewares_1.logger.error('Error getting popular suggestions:', error);
            return [];
        }
    }
    async recordUsage(type, value) {
        try {
            await (0, db_1.query)(`INSERT INTO apply_suggestions_cache (type, value, usage_count, last_used_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT ON CONSTRAINT idx_apply_suggestions_cache_unique DO UPDATE SET
           usage_count = apply_suggestions_cache.usage_count + 1,
           last_used_at = NOW()`, [type, value]);
        }
        catch (error) {
            middlewares_1.logger.error('Error recording suggestion usage:', error);
        }
    }
    async recordUsages(type, values) {
        try {
            for (const value of values) {
                await this.recordUsage(type, value);
            }
        }
        catch (error) {
            middlewares_1.logger.error('Error recording suggestion usages:', error);
        }
    }
}
exports.ApplySuggestionsService = ApplySuggestionsService;
//# sourceMappingURL=applySuggestionsService.js.map