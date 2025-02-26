const axios = require('axios');
const config = require('../../config/default');
const NodeCache = require('node-cache');
const openaiService = require('./openaiService');
const redditService = require('./redditService');

// Cache setup
const cache = new NodeCache({ stdTTL: config.cache.ttl });

const hackerNewsService = {
  // Get cache for clearing
  getCache() {
    return cache;
  },
  // Fetch the top stories from HN
  async getTopStories() {
    const cacheKey = 'hn_top_stories';
    
    // Check if we have cached data
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      const response = await axios.get(`${config.hackernews.baseUrl}/topstories.json`);
      const topStoryIds = response.data.slice(0, config.hackernews.maxItems);
      
      // Cache the results
      cache.set(cacheKey, topStoryIds);
      
      return topStoryIds;
    } catch (error) {
      console.error('Error fetching top stories from Hacker News:', error);
      throw error;
    }
  },
  
  // Fetch a single article by ID
  async getArticleById(id) {
    const cacheKey = `hn_article_${id}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      const response = await axios.get(`${config.hackernews.baseUrl}/item/${id}.json`);
      const article = response.data;
      
      // Cache the result
      cache.set(cacheKey, article);
      
      return article;
    } catch (error) {
      console.error(`Error fetching article ${id} from Hacker News:`, error);
      throw error;
    }
  },
  
  // Get all articles with details from top stories
  async getAllTopArticles() {
    try {
      const topStoryIds = await this.getTopStories();
      console.log(`Got ${topStoryIds.length} top story IDs from Hacker News`);
      
      // Limit to first 30 for faster debugging
      const limitedIds = topStoryIds.slice(0, 30);
      console.log(`Processing first ${limitedIds.length} stories`);
      
      // Fetch article details in parallel
      const articles = await Promise.all(
        limitedIds.map(id => this.getArticleById(id))
      );
      
      // Filter out items that aren't stories or don't have URLs
      const validArticles = articles.filter(article => 
        article && article.type === 'story' && article.url
      ).map(article => ({
        ...article,
        source: 'hackernews' // Add source field to HN articles
      }));
      
      console.log(`Found ${validArticles.length} valid articles with URLs`);
      
      // Log a sample article for debugging
      if (validArticles.length > 0) {
        console.log('Sample article:', JSON.stringify(validArticles[0], null, 2));
      }
      
      return validArticles;
    } catch (error) {
      console.error('Error fetching all top articles:', error);
      throw error;
    }
  },
  
  // Get articles filtered for Engineering Management relevance
  async getTopEMArticles() {
    const cacheKey = 'top_em_articles';
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      const allArticles = await this.getAllSourceArticles();
      
      // Filter articles for EM relevance using OpenAI
      const emArticles = await openaiService.filterArticlesForEM(allArticles);
      
      // Cache the results
      cache.set(cacheKey, emArticles);
      
      return emArticles;
    } catch (error) {
      console.error('Error filtering top EM articles:', error);
      throw error;
    }
  },
  
  // Get articles from all enabled sources
  async getAllSourceArticles() {
    try {
      const enabledSources = config.sources.enabled;
      console.log(`Enabled sources: ${enabledSources.join(', ')}`);
      
      let allArticles = [];
      
      // Get articles from Hacker News if enabled
      if (enabledSources.includes('hackernews')) {
        const hnArticles = await this.getAllTopArticles();
        console.log(`Retrieved ${hnArticles.length} valid articles from Hacker News`);
        allArticles = [...allArticles, ...hnArticles];
      }
      
      // Get articles from Reddit if enabled
      if (enabledSources.includes('reddit')) {
        const redditPosts = await redditService.getTopPosts();
        console.log(`Retrieved ${redditPosts.length} valid posts from Reddit`);
        allArticles = [...allArticles, ...redditPosts];
      }
      
      console.log(`Combined ${allArticles.length} total articles from all enabled sources`);
      
      return allArticles;
    } catch (error) {
      console.error('Error fetching articles from enabled sources:', error);
      throw error;
    }
  }
};

module.exports = hackerNewsService;