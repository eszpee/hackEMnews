const express = require('express');
const router = express.Router();
const hnService = require('../services/hackerNewsService');
const redditService = require('../services/redditService');
const openaiService = require('../services/openaiService');
const contentExtractorService = require('../services/contentExtractorService');
const config = require('../../config/default');
const NodeCache = require('node-cache');

// Get top EM articles
router.get('/articles', async (req, res) => {
  try {
    // Fetch articles from all enabled sources
    const articles = await hnService.getTopEMArticles();
    
    // Log some debug info about the articles
    console.log('API debug - Article sources breakdown:');
    const sourceCounts = {};
    articles.forEach(article => {
      const source = article.source || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    console.log('Sources count:', sourceCounts);
    console.log('First few articles:', articles.slice(0, 3).map(a => ({
      title: a.title,
      source: a.source,
      relevanceScore: a.relevanceScore,
      url: a.url
    })));
    
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get raw Reddit posts (for debugging)
router.get('/reddit-posts', async (req, res) => {
  try {
    // Fetch posts directly from Reddit
    const posts = await redditService.getTopPosts();
    res.json({
      count: posts.length,
      posts: posts
    });
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    res.status(500).json({ error: 'Failed to fetch Reddit posts', message: error.message });
  }
});

// Get a summary for a specific article
router.get('/summary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get article details
    const article = await hnService.getArticleById(id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Generate summary
    const summary = await openaiService.generateSummary(article);
    
    res.json({ id, summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Get top stories with summaries (main endpoint for frontend)
router.get('/top-em-stories', async (req, res) => {
  try {
    // Get filtered articles relevant to EM
    const articles = await hnService.getTopEMArticles();
    console.log(`API: Retrieved ${articles.length} articles from service`);
    
    // Generate summaries for each article if not already cached
    const articlesWithSummaries = await Promise.all(
      articles.map(async (article) => {
        const summary = await openaiService.generateSummary(article);
        return {
          ...article,
          summary
        };
      })
    );
    
    const responseArticles = articlesWithSummaries.slice(0, config.articles.maxResults);
    console.log(`API: Sending ${responseArticles.length} articles with summaries`);
    
    // Log a sample article for debugging
    if (responseArticles.length > 0) {
      console.log('API: Sample article being sent:', {
        id: responseArticles[0].id,
        title: responseArticles[0].title,
        summary: responseArticles[0].summary ? responseArticles[0].summary.substring(0, 50) + '...' : 'No summary',
        url: responseArticles[0].url
      });
    }
    
    res.json(responseArticles);
  } catch (error) {
    console.error('Error fetching top EM stories:', error);
    res.status(500).json({ error: 'Failed to fetch top EM stories' });
  }
});

// Clear cache endpoint for development and testing
router.post('/clear-cache', (req, res) => {
  try {
    // Access the cache from services and clear it
    const hnCache = hnService.getCache();
    const redditCache = redditService.getCache();
    const openaiCache = openaiService.getCache();
    const contentCache = contentExtractorService.getCache();
    
    const hnKeys = hnCache.keys();
    const redditKeys = redditCache.keys();
    const openaiKeys = openaiCache.keys();
    const contentKeys = contentCache.keys();
    
    hnCache.flushAll();
    redditCache.flushAll();
    openaiCache.flushAll();
    contentCache.flushAll();
    
    console.log('Cache cleared manually via API endpoint');
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      stats: {
        hnCacheKeysCleared: hnKeys.length,
        redditCacheKeysCleared: redditKeys.length,
        openaiCacheKeysCleared: openaiKeys.length,
        contentCacheKeysCleared: contentKeys.length
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Debug endpoint to access Reddit directly
router.get('/debug-reddit', async (req, res) => {
  try {
    // Clear Reddit cache
    redditService.getCache().flushAll();
    
    // Fetch fresh posts from Reddit
    const posts = await redditService.getTopPosts();
    
    res.json({
      subreddit: config.reddit.subreddits[0],
      count: posts.length,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title,
        url: p.url,
        source: p.source,
        subreddit: p.subreddit
      }))
    });
  } catch (error) {
    console.error('Error in debug-reddit endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch Reddit posts',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;