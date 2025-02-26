const axios = require('axios');
const config = require('../../config/default');
const NodeCache = require('node-cache');

// Cache setup
const cache = new NodeCache({ 
  stdTTL: config.cache.ttl,
  checkperiod: Math.floor(config.cache.ttl / 10), // Check for expired keys
  useClones: false // For better performance
});

const redditService = {
  // Get cache for clearing
  getCache() {
    return cache;
  },
  
  // Fetch top posts from r/EngineeringManagers
  async getTopPosts() {
    const cacheKey = 'reddit_top_posts';
    
    // For debugging, force clear cache every time
    if (cache.has(cacheKey)) {
      cache.del(cacheKey);
      console.log('Forced clearing Reddit cache for debugging');
    }
    
    try {
      const allPosts = [];
      
      // Fetch posts from each configured subreddit
      for (const subreddit of config.reddit.subreddits) {
        const url = `https://www.reddit.com/r/${subreddit}/top/.json?limit=${config.reddit.maxItems}&t=${config.reddit.timeRange}&raw_json=1`;
        console.log(`Fetching Reddit posts from: ${url}`);
        
        try {
          // Add more browser-like headers to prevent Reddit API blocking
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0'
          };
          
          console.log(`Making request to ${url} with User-Agent: ${headers['User-Agent']}`);
          
          const response = await axios.get(url, { 
            headers,
            timeout: config.requests.timeout || 15000 
          });
          
          // Log response details
          console.log(`Reddit API response status: ${response.status}`);
          console.log(`Reddit API response data type: ${typeof response.data}`);
          
          if (!response.data || !response.data.data || !response.data.data.children) {
            console.error('Invalid Reddit API response format:', JSON.stringify(response.data).substring(0, 200) + '...');
            continue; // Skip this subreddit and continue with others
          }
          
          const posts = response.data.data.children;
          console.log(`Fetched ${posts.length} raw posts from r/${subreddit}`);
          
          if (posts.length === 0) {
            console.log(`No posts returned from r/${subreddit}`);
            continue;
          }
          
          // Log first post for debugging
          console.log('Sample post data:', JSON.stringify(posts[0].data, null, 2).substring(0, 500) + '...');
          
          // Transform posts to match the format of HN articles
          const formattedPosts = posts.map(post => {
            const postData = post.data;
            
            // Create a properly formatted post object
            const formattedPost = {
              id: postData.id,
              title: postData.title,
              url: postData.url || `https://www.reddit.com${postData.permalink}`, // Use permalink as fallback if url is missing
              score: postData.score,
              by: postData.author,
              time: postData.created_utc,
              source: 'reddit', // Very important to set this field
              subreddit: subreddit,
              permalink: `https://www.reddit.com${postData.permalink}`
            };
            
            // Log the formatted post for debugging
            console.log(`Formatted Reddit post: id=${formattedPost.id}, source=${formattedPost.source}, title=${formattedPost.title.substring(0, 40)}...`);
            
            return formattedPost;
          });
          
          console.log(`Formatted ${formattedPosts.length} posts from r/${subreddit}`);
          
          // Log a sample formatted post
          if (formattedPosts.length > 0) {
            console.log('Sample formatted post:', JSON.stringify(formattedPosts[0], null, 2));
          }
          
          allPosts.push(...formattedPosts);
        } catch (error) {
          console.error(`Error fetching posts from r/${subreddit}:`, error.message);
          if (error.response) {
            console.error(`Status: ${error.response.status}, Data:`, error.response.data);
          }
        }
      }
      
      console.log(`Retrieved ${allPosts.length} posts from Reddit`);
      
      // Filter out posts that don't have URLs
      const validPosts = allPosts.filter(post => {
        // Check if post has a URL
        if (!post.url) {
          console.log(`Post ${post.id} filtered out: missing URL`);
          return false;
        }
        
        // Check if post is just an image or video
        if (post.url.includes('i.redd.it') || post.url.includes('v.redd.it')) {
          console.log(`Post ${post.id} filtered out: direct image/video URL (${post.url})`);
          return false;
        }
        
        // If it's a self post (links to reddit), we should include it
        if (post.url.includes('reddit.com/r/')) {
          console.log(`Post ${post.id} kept: self post/discussion (${post.url})`);
          return true;
        }
        
        return true;
      });
      
      console.log(`Found ${validPosts.length} valid Reddit posts with external URLs`);
      
      // Cache the results
      cache.set(cacheKey, validPosts);
      
      return validPosts;
    } catch (error) {
      console.error('Error fetching top posts from Reddit:', error);
      throw error;
    }
  }
};

module.exports = redditService;