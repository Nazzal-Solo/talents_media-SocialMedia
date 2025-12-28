# Feed Ranking Algorithm Documentation

## Overview

The Talents Media platform uses a sophisticated ranking algorithm to personalize content across three main surfaces:

1. **Home Feed** (`GET /api/posts/feed`) - Personalized feed prioritizing friends and connections
2. **Explore Feed** (`GET /api/posts/explore`) - Discovery feed focusing on trending content
3. **Search Results** (`GET /api/posts/search`) - Search results ranked by relevance and social signals

## Architecture

The ranking system follows a **3-stage pipeline**:

### 1. Candidate Generation

Efficient database queries fetch a pool of relevant posts (typically 200-400 candidates) based on:

- **Home Feed**: Followed users, mutual connections, second-degree connections
- **Explore**: Non-followed users with high engagement, trending content
- **Search**: Posts matching the search query (text/hashtag)

### 2. Scoring

Each candidate post receives multiple feature scores that are combined into a final ranking score:

- **Relationship Score** (0.0 - 1.0): How close is the author to the viewer?
  - Mutual follow: 0.9
  - Following: 0.7
  - Not following: 0.1
  - Boosted by recent interactions (reactions, comments)

- **Engagement Score** (0.0 - 1.0): How well is the post performing?
  - Based on reactions, comments, and views in the last 7 days
  - Normalized by post age (older posts need more engagement)

- **Personalization Score** (0.0 - 1.0): Does this match the user's interests?
  - Built from hashtags on posts the user interacted with
  - Reactions: +2.0 per hashtag
  - Comments: +3.0 per hashtag
  - Views: +0.5 per hashtag

- **Recency Score** (0.0 - 1.0): How fresh is the post?
  - Exponential decay: `e^(-hours / 24)`
  - Half-life: 24 hours

- **Negative Feedback Score** (-1.0 - 0.0): User preferences
  - Hidden posts: -1.0
  - Not interested: -1.0
  - Reported: -1.0
  - Heavily reported (>5 reports): -0.5

### 3. Post-Processing

- Filter out posts with strong negative feedback
- Apply author diversity penalty (avoid spam from same author)
- Sort by final score
- Paginate results

## Configuration

Ranking weights are configured in `server/src/config/ranking.ts`:

### Home Feed Weights

```typescript
{
  relationship: 0.5,        // Highest priority: friends first
  engagement: 0.2,
  personalization: 0.15,
  recency: 0.1,
  negativeFeedback: -1.0,
  authorDiversityPenalty: 0.05
}
```

### Explore Feed Weights

```typescript
{
  relationship: 0.1,        // Low: we want discovery
  engagement: 0.35,        // High: trending content
  personalization: 0.25,
  recency: 0.25,
  negativeFeedback: -1.0,
  authorDiversityPenalty: 0.05
}
```

### Search Weights

```typescript
{
  relationship: 0.2,
  engagement: 0.25,
  personalization: 0.2,
  recency: 0.15,
  negativeFeedback: -1.0,
  authorDiversityPenalty: 0.05
}
```

## Tuning the Algorithm

### Adjusting Weights

To change how posts are ranked, edit the weight values in `server/src/config/ranking.ts`:

- **Increase relationship weight**: More emphasis on friends' posts
- **Increase engagement weight**: More emphasis on trending/viral content
- **Increase personalization weight**: More emphasis on user interests
- **Increase recency weight**: More emphasis on fresh content

**Important**: Weights should generally sum to around 1.0 for the positive features (relationship, engagement, personalization, recency). Negative feedback is applied separately.

### Adjusting Time Windows

In `RANKING_CONFIG`:

- `ENGAGEMENT_WINDOW_DAYS`: How far back to look for engagement (default: 7 days)
- `RELATIONSHIP_WINDOW_DAYS`: How far back to look for interactions (default: 30 days)
- `INTEREST_WINDOW_DAYS`: How far back to build interest profile (default: 30 days)
- `RECENCY_DECAY_HALF_LIFE_HOURS`: How quickly recency decays (default: 24 hours)

### Adjusting Candidate Pool Size

- `MAX_CANDIDATES`: Maximum posts to fetch before ranking (default: 400)
- `MIN_CANDIDATES`: Minimum posts to fetch (default: 50)

## Database Schema Assumptions

The ranking algorithm assumes these tables exist:

- `users` - User accounts
- `posts` - Posts with `text`, `created_at`, `user_id`, `visibility`
- `follows` - Follow relationships (`follower_id`, `following_id`)
- `reactions` - Post reactions (`user_id`, `post_id`, `kind`, `created_at`)
- `comments` - Post comments (`user_id`, `post_id`, `created_at`)
- `views` - Post views (`user_id`, `post_id`, `created_at`)
- `hidden_posts` - User-hidden posts (`user_id`, `post_id`)
- `not_interested_posts` - Not interested posts (`user_id`, `post_id`)
- `reported_posts` - Reported posts (`user_id`, `post_id`)

## Performance Considerations

- Candidate generation uses indexed queries for efficiency
- Relationship scores are computed per post (could be cached for better performance)
- Interest profiles are computed once per request and reused
- Bulk queries are used to fetch reactions/comments/views

## Future Improvements

Potential enhancements:

1. **Caching**: Cache relationship scores and interest profiles
2. **Machine Learning**: Use ML models for better personalization
3. **Real-time Updates**: Update rankings as new interactions occur
4. **A/B Testing**: Test different weight configurations
5. **Content Type Diversity**: Enforce mix of text/image/video posts
6. **Time-based Preferences**: Adjust weights based on time of day

## API Endpoints

- `GET /api/posts/feed?page=1&limit=20` - Ranked home feed
- `GET /api/posts/explore?page=1&limit=20` - Ranked explore feed
- `GET /api/posts/search?q=query&limit=20` - Ranked search results

All endpoints maintain backward compatibility with existing pagination and response formats.
