module.exports = {
  sources: {
    enabled: ['reddit', 'hackernews'], // Available options: 'hackernews', 'reddit'
  },
  server: {
    port: process.env.PORT || 3000,
  },
  hackernews: {
    baseUrl: 'https://hacker-news.firebaseio.com/v0',
    maxItems: 100, // How many top stories to fetch from HN
  },
  reddit: {
    subreddits: ['EngineeringManagers'],
    maxItems: 30, // How many top posts to fetch from each subreddit
    timeRange: 'week', // one of: hour, day, week, month, year, all
  },
  articles: {
    maxResults: 10, // Show top 10 articles 
    minRelevanceScore: 0.5, // Minimum relevance score (0-1) to include an article
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
    retries: 2, // Number of retries if API call fails
    timeout: 15000, // Timeout in milliseconds for API calls
  },
  requests: {
    timeout: 12000, // Timeout in milliseconds for article downloads
    maxContentLength: 5 * 1024 * 1024, // 5MB max for article downloads
  },
  cache: {
    ttl: 3600, // Cache TTL in seconds (1 hour)
  },
  targetAudience: {
    // This prompt helps filter and generate summaries targeted to EM audience
    prompt: `
      Focus on articles relevant to Engineering Managers who:
      - Are new to management, especially those transitioning from a developer background
      - Need practical advice for technical leadership and team management
      - Want to improve communication, delegation, and mentoring skills
      - Are interested in creating effective engineering processes and culture
      
      Highlight aspects that are specifically valuable for engineering managers.
    `
  }
};