// Database migration script
import { query, testConnection } from './db';

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    website TEXT,
    location VARCHAR(100),
    theme_pref VARCHAR(20) DEFAULT 'dark-neon',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin'))
  )`,

  // Sessions table
  `CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
    user_agent TEXT,
    ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
  )`,

  // Posts table
  `CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT,
    media_url TEXT,
    media_type VARCHAR(10) DEFAULT 'none' CHECK (media_type IN ('image', 'video', 'none')),
    visibility VARCHAR(10) DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
    feeling VARCHAR(100),
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Comments table
  `CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Reactions table
  `CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_reaction UNIQUE (user_id, post_id, comment_id),
    CONSTRAINT reaction_target CHECK (
      (post_id IS NOT NULL AND comment_id IS NULL) OR 
      (post_id IS NULL AND comment_id IS NOT NULL)
    )
  )`,

  // Follows table
  `CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
  )`,

  // Reels table
  `CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    duration_sec INTEGER,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Conversations table
  `CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN DEFAULT FALSE,
    title VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Conversation members table
  `CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
  )`,

  // Messages table
  `CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
  )`,

  // Notifications table
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Ads table
  `CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT,
    video_url TEXT,
    headline VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    cta_url TEXT,
    targeting JSONB,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Views table
  `CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    ip VARCHAR(45),
    country VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT view_target CHECK (
      (post_id IS NOT NULL AND reel_id IS NULL) OR 
      (post_id IS NULL AND reel_id IS NOT NULL)
    )
  )`,

  // Password resets table
  `CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // OAuth accounts table
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google')),
    provider_account_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
  )`,

  // Admin audit logs table
  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Hidden posts table
  `CREATE TABLE IF NOT EXISTS hidden_posts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
  )`,

  // Reported posts table
  `CREATE TABLE IF NOT EXISTS reported_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reason VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id)
  )`,

  // Not interested posts table
  `CREATE TABLE IF NOT EXISTS not_interested_posts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
  )`,

  // News items table
  `CREATE TABLE IF NOT EXISTS news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,
    image_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Candidate profiles
  `CREATE TABLE IF NOT EXISTS apply_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    skills TEXT[] DEFAULT '{}',
    job_titles TEXT[] DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    salary_min INTEGER,
    salary_max INTEGER,
    include_keywords TEXT[] DEFAULT '{}',
    exclude_keywords TEXT[] DEFAULT '{}',
    cv_url TEXT,
    portfolio_urls TEXT[] DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    auto_apply_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Job listings
  `CREATE TABLE IF NOT EXISTS apply_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location TEXT,
    description TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10),
    job_url TEXT NOT NULL,
    application_url TEXT,
    application_method VARCHAR(50) DEFAULT 'email',
    posted_date TIMESTAMP WITH TIME ZONE,
    expires_date TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(external_id, source)
  )`,

  // Apply system: Applications
  `CREATE TABLE IF NOT EXISTS apply_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES apply_jobs(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'failed', 'skipped', 'pending')),
    match_score DECIMAL(5,2),
    match_reason TEXT,
    application_method VARCHAR(50),
    application_details JSONB,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
  )`,

  // Apply system: Plans
  `CREATE TABLE IF NOT EXISTS apply_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    daily_apply_limit INTEGER NOT NULL,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: User plan subscriptions
  `CREATE TABLE IF NOT EXISTS apply_user_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES apply_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Activity logs
  `CREATE TABLE IF NOT EXISTS apply_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES apply_jobs(id) ON DELETE SET NULL,
    application_id UUID REFERENCES apply_applications(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Daily apply quotas (tracks daily limits)
  `CREATE TABLE IF NOT EXISTS apply_daily_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    applied_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
  )`,

  // Apply system: Structured locations
  `CREATE TABLE IF NOT EXISTS apply_profile_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES apply_profiles(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_type VARCHAR(20) DEFAULT 'onsite' CHECK (location_type IN ('remote', 'onsite', 'hybrid')),
    is_remote BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, display_name, location_type)
  )`,

  // Apply system: CV/Resume assets (Cloudinary)
  `CREATE TABLE IF NOT EXISTS apply_cv_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES apply_profiles(id) ON DELETE CASCADE,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    cloudinary_url TEXT NOT NULL,
    cloudinary_secure_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(50),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Suggestions cache (popular items)
  `CREATE TABLE IF NOT EXISTS apply_suggestions_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('skill', 'job_title', 'keyword', 'location')),
    value VARCHAR(255) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Apply system: Countries database
  `CREATE TABLE IF NOT EXISTS apply_countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    iso2 VARCHAR(2) UNIQUE,
    iso3 VARCHAR(3) UNIQUE,
    aliases TEXT[] DEFAULT '{}',
    normalized_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(normalized_key)
  )`,

  // Apply system: Cities database
  `CREATE TABLE IF NOT EXISTS apply_cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country_id UUID NOT NULL REFERENCES apply_countries(id) ON DELETE CASCADE,
    admin_region VARCHAR(255),
    population INTEGER,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    aliases TEXT[] DEFAULT '{}',
    normalized_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(normalized_key, country_id)
  )`,

  // Apply system: Job sources (auto-generated from user profiles)
  `CREATE TABLE IF NOT EXISTS apply_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    query_params JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, query_params)
  )`,

  // Apply system: Job matches (stores match results before applying)
  `CREATE TABLE IF NOT EXISTS job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES apply_jobs(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL,
    match_reasons JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'skipped', 'applied', 'failed', 'assisted_required')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
  )`,

  // Companies database (dev/core feature)
  `CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address_text TEXT NOT NULL,
    headquarters_country TEXT NOT NULL,
    headquarters_city TEXT,
    website TEXT,
    primary_email TEXT,
    hr_email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    industry TEXT,
    size_range TEXT,
    founded_year INT,
    description TEXT,
    logo_url TEXT,
    job_titles TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    source TEXT,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
];

// Column migrations for existing tables (add new columns)
const columnMigrations = [
  // Add parent_comment_id to comments table if it doesn't exist
  `DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='comments' AND column_name='parent_comment_id'
    ) THEN
      ALTER TABLE comments ADD COLUMN parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
    END IF;
  END $$;`,
  // Add preferred_run_time to apply_profiles table
  `DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='apply_profiles' AND column_name='preferred_run_time'
    ) THEN
      ALTER TABLE apply_profiles ADD COLUMN preferred_run_time TIME DEFAULT '09:00:00';
    END IF;
  END $$;`,
  // Add feeling and location to posts table if they don't exist
  `DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='posts' AND column_name='feeling'
    ) THEN
      ALTER TABLE posts ADD COLUMN feeling VARCHAR(100);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='posts' AND column_name='location'
    ) THEN
      ALTER TABLE posts ADD COLUMN location TEXT;
    END IF;
  END $$;`,
  
  // Apply system: Add salary_currency to profiles if it doesn't exist
  `DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='apply_profiles' AND column_name='salary_currency'
    ) THEN
      ALTER TABLE apply_profiles ADD COLUMN salary_currency VARCHAR(10) DEFAULT 'USD';
    END IF;
  END $$;`,

  // Apply system: Add apply_email and is_remote to apply_jobs
  `DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='apply_jobs' AND column_name='apply_email'
    ) THEN
      ALTER TABLE apply_jobs ADD COLUMN apply_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='apply_jobs' AND column_name='is_remote'
    ) THEN
      ALTER TABLE apply_jobs ADD COLUMN is_remote BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='apply_jobs' AND column_name='job_hash'
    ) THEN
      ALTER TABLE apply_jobs ADD COLUMN job_hash VARCHAR(64);
    END IF;
  END $$;`,

  // Apply system: Update apply_applications status to include assisted_required
  `DO $$ 
  BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE apply_applications DROP CONSTRAINT IF EXISTS apply_applications_status_check;
    -- Add new constraint with assisted_required
    ALTER TABLE apply_applications ADD CONSTRAINT apply_applications_status_check 
      CHECK (status IN ('applied', 'failed', 'skipped', 'pending', 'assisted_required'));
  END $$;`,
];

// Indexes for performance
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC)',
  // Index for feed queries - ordering by created_at with visibility filter
  'CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON posts(visibility, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)',
  'CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id)',
  'CREATE INDEX IF NOT EXISTS idx_reactions_comment ON reactions(comment_id)',
  'CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)',
  'CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reels_created ON reels(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(active)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)',
  'CREATE INDEX IF NOT EXISTS idx_views_post ON views(post_id)',
  'CREATE INDEX IF NOT EXISTS idx_views_reel ON views(reel_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash)',
  'CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_news_published ON news_items(published_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_hidden_posts_user ON hidden_posts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_hidden_posts_post ON hidden_posts(post_id)',
  'CREATE INDEX IF NOT EXISTS idx_reported_posts_user ON reported_posts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_reported_posts_post ON reported_posts(post_id)',
  'CREATE INDEX IF NOT EXISTS idx_reported_posts_status ON reported_posts(status)',
  'CREATE INDEX IF NOT EXISTS idx_not_interested_posts_user ON not_interested_posts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_not_interested_posts_post ON not_interested_posts(post_id)',
  // Index for media type searches (used by Quick Actions - Explore Photos, Watch Videos)
  'CREATE INDEX IF NOT EXISTS idx_posts_media_type_visibility ON posts(media_type, visibility, created_at DESC) WHERE visibility = \'public\'',
  
  // Apply system indexes
  'CREATE INDEX IF NOT EXISTS idx_apply_profiles_user ON apply_profiles(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_jobs_source_external ON apply_jobs(source, external_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_jobs_posted_date ON apply_jobs(posted_date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_apply_applications_user ON apply_applications(user_id, applied_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_apply_applications_job ON apply_applications(job_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_applications_status ON apply_applications(status)',
  'CREATE INDEX IF NOT EXISTS idx_apply_user_plans_user ON apply_user_plans(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_user_plans_status ON apply_user_plans(status)',
  'CREATE INDEX IF NOT EXISTS idx_apply_activity_logs_user ON apply_activity_logs(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_apply_daily_quotas_user_date ON apply_daily_quotas(user_id, date DESC)',
  
  // Apply system new indexes
  'CREATE INDEX IF NOT EXISTS idx_apply_profile_locations_profile ON apply_profile_locations(profile_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_cv_assets_profile ON apply_cv_assets(profile_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_suggestions_cache_type_value ON apply_suggestions_cache(type, LOWER(value))',
  'CREATE INDEX IF NOT EXISTS idx_apply_suggestions_cache_popular ON apply_suggestions_cache(type, usage_count DESC, last_used_at DESC)',
  
  // Location database indexes for fast autocomplete
  'CREATE INDEX IF NOT EXISTS idx_apply_countries_normalized ON apply_countries(normalized_key)',
  'CREATE INDEX IF NOT EXISTS idx_apply_countries_name_lower ON apply_countries(LOWER(name))',
  'CREATE INDEX IF NOT EXISTS idx_apply_cities_normalized ON apply_cities(normalized_key)',
  'CREATE INDEX IF NOT EXISTS idx_apply_cities_country ON apply_cities(country_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_cities_name_lower ON apply_cities(LOWER(name))',
  'CREATE INDEX IF NOT EXISTS idx_apply_cities_population ON apply_cities(population DESC NULLS LAST)',

  // Automation system indexes
  'CREATE INDEX IF NOT EXISTS idx_apply_sources_user ON apply_sources(user_id, enabled)',
  'CREATE INDEX IF NOT EXISTS idx_apply_sources_provider ON apply_sources(provider, last_fetched_at)',
  'CREATE INDEX IF NOT EXISTS idx_job_matches_user_status ON job_matches(user_id, status)',
  'CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches(job_id)',
  'CREATE INDEX IF NOT EXISTS idx_apply_jobs_hash ON apply_jobs(job_hash)',
  'CREATE INDEX IF NOT EXISTS idx_apply_jobs_remote ON apply_jobs(is_remote)',
  
  // Companies database indexes
  'CREATE INDEX IF NOT EXISTS idx_companies_name_lower ON companies ((lower(name)))',
  'CREATE INDEX IF NOT EXISTS idx_companies_country ON companies (headquarters_country)',
  'CREATE INDEX IF NOT EXISTS idx_companies_is_deleted ON companies (is_deleted)',
];

export const runMigrations = async () => {
  try {
    await testConnection();

    console.log('🔄 Running migrations...');

    // Run table migrations
    for (const migration of migrations) {
      await query(migration);
    }

    // Run column migrations (add new columns to existing tables)
    for (const columnMigration of columnMigrations) {
      await query(columnMigration);
    }

    // Run index migrations
    for (const index of indexes) {
      await query(index);
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};
