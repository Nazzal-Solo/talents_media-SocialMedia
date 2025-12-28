"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedApplySuggestions = void 0;
const db_1 = require("../models/db");
const seedSuggestions = [
    {
        type: 'skill',
        values: [
            'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'C#',
            'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'SQL', 'PostgreSQL',
            'MySQL', 'MongoDB', 'Redis', 'AWS', 'Docker', 'Kubernetes', 'Git', 'Linux',
            'HTML', 'CSS', 'SASS', 'Tailwind CSS', 'Vue.js', 'Angular', 'Next.js',
            'Express.js', 'Django', 'Flask', 'Spring Boot', 'GraphQL', 'REST API',
            'Microservices', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Terraform',
            'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas',
            'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Wireframing', 'Prototyping'
        ],
    },
    {
        type: 'job_title',
        values: [
            'Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
            'DevOps Engineer', 'Cloud Engineer', 'Data Engineer', 'Data Scientist',
            'Machine Learning Engineer', 'Mobile Developer', 'iOS Developer', 'Android Developer',
            'UI/UX Designer', 'Product Designer', 'Graphic Designer', 'Web Designer',
            'Product Manager', 'Project Manager', 'Scrum Master', 'QA Engineer',
            'Test Engineer', 'Security Engineer', 'Site Reliability Engineer', 'Database Administrator',
            'Solutions Architect', 'Technical Lead', 'Engineering Manager', 'CTO',
            'Junior Developer', 'Senior Developer', 'Principal Engineer'
        ],
    },
    {
        type: 'keyword',
        values: [
            'remote', 'hybrid', 'onsite', 'full-time', 'part-time', 'contract', 'freelance',
            'startup', 'enterprise', 'agile', 'scrum', 'kanban', 'microservices',
            'cloud-native', 'serverless', 'blockchain', 'cryptocurrency', 'fintech',
            'healthtech', 'edtech', 'e-commerce', 'SaaS', 'B2B', 'B2C'
        ],
    },
];
const seedApplySuggestions = async () => {
    try {
        await (0, db_1.testConnection)();
        console.log('🌱 Seeding Apply suggestions cache...');
        for (const { type, values } of seedSuggestions) {
            for (const value of values) {
                await (0, db_1.query)(`INSERT INTO apply_suggestions_cache (type, value, usage_count, last_used_at)
           VALUES ($1, $2, 10, NOW())
           ON CONFLICT (type, LOWER(value)) DO UPDATE SET
             usage_count = GREATEST(apply_suggestions_cache.usage_count, 10),
             last_used_at = NOW()`, [type, value]);
            }
            console.log(`✅ Seeded ${values.length} ${type} suggestions`);
        }
        console.log('✅ Apply suggestions cache seeded successfully');
    }
    catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    }
};
exports.seedApplySuggestions = seedApplySuggestions;
if (require.main === module) {
    (0, exports.seedApplySuggestions)()
        .then(() => {
        console.log('Done');
        process.exit(0);
    })
        .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=seed-apply-suggestions.js.map