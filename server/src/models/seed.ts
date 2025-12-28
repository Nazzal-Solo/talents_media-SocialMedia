import { query } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Seed data
const seedUsers = [
  {
    id: uuidv4(),
    email: 'admin@social.com',
    username: 'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    display_name: 'Admin User',
    avatar_url: 'https://via.placeholder.com/150',
    bio: 'Platform administrator',
    role: 'admin',
    theme_pref: 'dark-neon'
  },
  {
    id: uuidv4(),
    email: 'john@example.com',
    username: 'john_doe',
    password_hash: bcrypt.hashSync('password123', 10),
    display_name: 'John Doe',
    avatar_url: 'https://via.placeholder.com/150',
    bio: 'Software developer and tech enthusiast',
    location: 'San Francisco, CA',
    theme_pref: 'dark-neon'
  },
  {
    id: uuidv4(),
    email: 'jane@example.com',
    username: 'jane_smith',
    password_hash: bcrypt.hashSync('password123', 10),
    display_name: 'Jane Smith',
    avatar_url: 'https://via.placeholder.com/150',
    bio: 'Designer and creative director',
    location: 'New York, NY',
    theme_pref: 'magenta'
  },
  {
    id: uuidv4(),
    email: 'mike@example.com',
    username: 'mike_wilson',
    password_hash: bcrypt.hashSync('password123', 10),
    display_name: 'Mike Wilson',
    avatar_url: 'https://via.placeholder.com/150',
    bio: 'Photographer and travel blogger',
    location: 'Los Angeles, CA',
    theme_pref: 'cyan'
  }
];

// Generate more posts for better testing
const seedPosts = [
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Just launched my new project! Excited to share it with everyone. 🚀',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'Beautiful sunset from my balcony today. Nature never fails to amaze me. 🌅',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Working on some new photography techniques. Here\'s a sneak peek! 📸',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Coffee and code - the perfect morning combo! ☕💻',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'New design project coming soon! Stay tuned for updates 🎨',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Just finished editing this amazing landscape shot! 📷',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Weekend vibes! Time to relax and recharge 🌴',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'Working on a new creative direction. What do you think? ✨',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Travel photography is my passion. Here\'s a shot from my latest adventure! 🌍',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Learning new technologies every day. The journey never ends! 🚀',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'Design inspiration from nature. Sometimes the best ideas come from the simplest things 🌿',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Golden hour magic ✨ There\'s something special about this time of day',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Code review session with the team. Collaboration makes everything better! 👥',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'New color palette exploration. Colors can tell amazing stories 🎨',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Street photography in the city. Every corner tells a story 📸',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Refactoring day! Making the codebase cleaner and more maintainable 🧹',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'Typography matters! The right font can make all the difference ✍️',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Portrait session today. Capturing emotions is what photography is all about 📷',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    text: 'Debugging session complete! Nothing beats that feeling when you find the bug 🐛',
    media_type: 'none',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[2].id,
    text: 'Minimalist design principles. Less is more, always 🎯',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    text: 'Nature photography never gets old. The world is full of beauty 🌲',
    media_url: 'https://via.placeholder.com/600x400',
    media_type: 'image',
    visibility: 'public'
  }
];

const seedReels = [
  {
    id: uuidv4(),
    user_id: seedUsers[1].id,
    video_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    thumbnail_url: 'https://via.placeholder.com/300x400',
    caption: 'Quick coding session! 💻',
    duration_sec: 30,
    views_count: 150
  },
  {
    id: uuidv4(),
    user_id: seedUsers[3].id,
    video_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
    thumbnail_url: 'https://via.placeholder.com/300x400',
    caption: 'Behind the scenes of my latest photoshoot 📸',
    duration_sec: 45,
    views_count: 89
  }
];

const seedNews = [
  {
    id: uuidv4(),
    title: 'New Social Media Trends for 2024',
    url: 'https://example.com/news/1',
    source: 'Tech News',
    image_url: 'https://via.placeholder.com/300x200',
    published_at: new Date()
  },
  {
    id: uuidv4(),
    title: 'The Future of Digital Communication',
    url: 'https://example.com/news/2',
    source: 'Digital Trends',
    image_url: 'https://via.placeholder.com/300x200',
    published_at: new Date(Date.now() - 86400000) // 1 day ago
  }
];

const seedAds = [
  {
    id: uuidv4(),
    advertiser_user_id: seedUsers[0].id,
    image_url: 'https://via.placeholder.com/300x200',
    headline: 'Discover Amazing Products',
    body: 'Check out our latest collection of innovative products',
    cta_url: 'https://example.com/shop',
    targeting: { countries: ['US', 'CA'], interests: ['technology'] },
    active: true
  }
];

export const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...');

    // Clear existing data (in reverse order of dependencies)
    await query('DELETE FROM admin_audit_logs');
    await query('DELETE FROM password_resets');
    await query('DELETE FROM oauth_accounts');
    await query('DELETE FROM views');
    await query('DELETE FROM ads');
    await query('DELETE FROM news_items');
    await query('DELETE FROM notifications');
    await query('DELETE FROM messages');
    await query('DELETE FROM conversation_members');
    await query('DELETE FROM conversations');
    await query('DELETE FROM reactions');
    await query('DELETE FROM comments');
    await query('DELETE FROM reels');
    await query('DELETE FROM follows');
    await query('DELETE FROM posts');
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');

    // Insert users
    for (const user of seedUsers) {
      await query(
        `INSERT INTO users (id, email, username, password_hash, display_name, avatar_url, bio, location, theme_pref, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [user.id, user.email, user.username, user.password_hash, user.display_name, 
         user.avatar_url, user.bio, user.location, user.theme_pref, user.role]
      );
    }

    // Insert posts
    for (const post of seedPosts) {
      await query(
        `INSERT INTO posts (id, user_id, text, media_url, media_type, visibility)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [post.id, post.user_id, post.text, post.media_url, post.media_type, post.visibility]
      );
    }

    // Insert reels
    for (const reel of seedReels) {
      await query(
        `INSERT INTO reels (id, user_id, video_url, thumbnail_url, caption, duration_sec, views_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reel.id, reel.user_id, reel.video_url, reel.thumbnail_url, reel.caption, reel.duration_sec, reel.views_count]
      );
    }

    // Insert news items
    for (const news of seedNews) {
      await query(
        `INSERT INTO news_items (id, title, url, source, image_url, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [news.id, news.title, news.url, news.source, news.image_url, news.published_at]
      );
    }

    // Insert ads
    for (const ad of seedAds) {
      await query(
        `INSERT INTO ads (id, advertiser_user_id, image_url, headline, body, cta_url, targeting, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ad.id, ad.advertiser_user_id, ad.image_url, ad.headline, ad.body, ad.cta_url, JSON.stringify(ad.targeting), ad.active]
      );
    }

    // Create some follows
    await query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
      [seedUsers[1].id, seedUsers[2].id] // john follows jane
    );
    await query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
      [seedUsers[2].id, seedUsers[1].id] // jane follows john
    );
    await query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
      [seedUsers[1].id, seedUsers[3].id] // john follows mike
    );

    // Create some reactions
    await query(
      `INSERT INTO reactions (post_id, user_id, kind) VALUES ($1, $2, $3)`,
      [seedPosts[0].id, seedUsers[2].id, 'like']
    );
    await query(
      `INSERT INTO reactions (post_id, user_id, kind) VALUES ($1, $2, $3)`,
      [seedPosts[1].id, seedUsers[1].id, 'love']
    );

    // Create some comments
    await query(
      `INSERT INTO comments (post_id, user_id, text) VALUES ($1, $2, $3)`,
      [seedPosts[0].id, seedUsers[2].id, 'Congratulations! Looking forward to seeing more! 🎉']
    );
    await query(
      `INSERT INTO comments (post_id, user_id, text) VALUES ($1, $2, $3)`,
      [seedPosts[1].id, seedUsers[1].id, 'Absolutely stunning! 📸']
    );

    // Seed Apply system plans
    const freePlanId = uuidv4();
    const proPlanId = uuidv4();
    const premiumPlanId = uuidv4();

    await query(
      `INSERT INTO apply_plans (id, name, display_name, daily_apply_limit, price_monthly, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO NOTHING`,
      [
        freePlanId,
        'free',
        'Free',
        2,
        0,
        JSON.stringify({
          description: 'Perfect for getting started',
          features: ['2 applications per day', 'Basic job matching', 'Activity logs']
        }),
        true
      ]
    );

    await query(
      `INSERT INTO apply_plans (id, name, display_name, daily_apply_limit, price_monthly, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO UPDATE SET
         daily_apply_limit = EXCLUDED.daily_apply_limit,
         price_monthly = EXCLUDED.price_monthly,
         features = EXCLUDED.features`,
      [
        proPlanId,
        'pro',
        'Pro',
        10,  // MVP: Fixed 10 applications per day
        7.5,
        JSON.stringify({
          description: 'For serious job seekers',
          features: ['10 applications per day', 'Better matching', 'More customization', 'Priority support']
        }),
        true
      ]
    );

    await query(
      `INSERT INTO apply_plans (id, name, display_name, daily_apply_limit, price_monthly, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO NOTHING`,
      [
        premiumPlanId,
        'premium',
        'Premium',
        50,
        15,
        JSON.stringify({
          description: 'Maximum automation power',
          features: ['50+ applications per day', 'Advanced matching', 'Email outreach', 'Recruiter contact', 'Priority support']
        }),
        true
      ]
    );

    console.log('✅ Database seeded successfully');
    console.log(`👤 Created ${seedUsers.length} users`);
    console.log(`📝 Created ${seedPosts.length} posts`);
    console.log(`🎥 Created ${seedReels.length} reels`);
    console.log(`📰 Created ${seedNews.length} news items`);
    console.log(`📢 Created ${seedAds.length} ads`);
    console.log(`💼 Created 3 Apply plans`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};
