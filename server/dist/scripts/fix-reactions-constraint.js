"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixReactionsConstraint = fixReactionsConstraint;
const db_1 = require("../models/db");
async function fixReactionsConstraint() {
    try {
        console.log('🔄 Fixing reactions constraint...');
        console.log('📋 Cleaning up duplicate reactions...');
        await (0, db_1.query)(`
      DELETE FROM reactions r1
      USING (
        SELECT user_id, post_id, MAX(created_at) as max_created_at
        FROM reactions
        WHERE post_id IS NOT NULL AND comment_id IS NULL
        GROUP BY user_id, post_id
        HAVING COUNT(*) > 1
      ) duplicates
      WHERE r1.user_id = duplicates.user_id
        AND r1.post_id = duplicates.post_id
        AND r1.comment_id IS NULL
        AND r1.created_at < duplicates.max_created_at
    `);
        await (0, db_1.query)(`
      DELETE FROM reactions r1
      USING (
        SELECT user_id, comment_id, MAX(created_at) as max_created_at
        FROM reactions
        WHERE comment_id IS NOT NULL
        GROUP BY user_id, comment_id
        HAVING COUNT(*) > 1
      ) duplicates
      WHERE r1.user_id = duplicates.user_id
        AND r1.comment_id = duplicates.comment_id
        AND r1.created_at < duplicates.max_created_at
    `);
        console.log('✅ Duplicate reactions removed');
        console.log('🗑️  Dropping old constraint...');
        try {
            await (0, db_1.query)('ALTER TABLE reactions DROP CONSTRAINT IF EXISTS unique_reaction');
            console.log('✅ Old constraint dropped');
        }
        catch (error) {
            console.log('⚠️  Constraint might not exist:', error.message);
        }
        console.log('✨ Adding new constraint...');
        try {
            await (0, db_1.query)(`
        ALTER TABLE reactions 
        ADD CONSTRAINT unique_user_reaction 
        UNIQUE (user_id, post_id, comment_id)
      `);
            console.log('✅ New constraint added');
        }
        catch (error) {
            if (error.message?.includes('already exists') ||
                error.message?.includes('duplicate')) {
                console.log('⚠️  Constraint already exists, skipping...');
            }
            else {
                throw error;
            }
        }
        console.log('✅ Reactions constraint fixed successfully!');
    }
    catch (error) {
        console.error('❌ Failed to fix reactions constraint:', error);
        throw error;
    }
}
if (require.main === module) {
    fixReactionsConstraint()
        .then(() => {
        console.log('✅ Migration completed');
        process.exit(0);
    })
        .catch(error => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=fix-reactions-constraint.js.map