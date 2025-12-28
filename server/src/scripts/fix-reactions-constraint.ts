import { query } from '../models/db';

/**
 * Migration script to fix reactions table constraint
 * Changes from UNIQUE (user_id, post_id, comment_id, kind)
 * to UNIQUE (user_id, post_id, comment_id)
 * This ensures each user can only have ONE reaction per post/comment
 */
async function fixReactionsConstraint() {
  try {
    console.log('🔄 Fixing reactions constraint...');

    // Step 1: Remove duplicate reactions (keep the latest one for each user/post/comment)
    console.log('📋 Cleaning up duplicate reactions...');

    // Remove duplicates for posts (where comment_id is NULL)
    // Keep only the most recent reaction for each user/post combination
    await query(`
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

    // Remove duplicates for comments (where comment_id is NOT NULL)
    // Keep only the most recent reaction for each user/comment combination
    await query(`
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

    // Step 2: Drop the old constraint
    console.log('🗑️  Dropping old constraint...');
    try {
      await query(
        'ALTER TABLE reactions DROP CONSTRAINT IF EXISTS unique_reaction'
      );
      console.log('✅ Old constraint dropped');
    } catch (error: any) {
      console.log('⚠️  Constraint might not exist:', error.message);
    }

    // Step 3: Add the new constraint (one reaction per user per post/comment)
    console.log('✨ Adding new constraint...');
    try {
      await query(`
        ALTER TABLE reactions 
        ADD CONSTRAINT unique_user_reaction 
        UNIQUE (user_id, post_id, comment_id)
      `);
      console.log('✅ New constraint added');
    } catch (error: any) {
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('duplicate')
      ) {
        console.log('⚠️  Constraint already exists, skipping...');
      } else {
        throw error;
      }
    }

    console.log('✅ Reactions constraint fixed successfully!');
  } catch (error) {
    console.error('❌ Failed to fix reactions constraint:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
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

export { fixReactionsConstraint };
