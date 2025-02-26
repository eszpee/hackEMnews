const axios = require('axios');
const cheerio = require('cheerio');
const { convert } = require('html-to-text');
const NodeCache = require('node-cache');
const config = require('../../config/default');

// Setup cache for article content
const cache = new NodeCache({ stdTTL: config.cache.ttl * 2 }); // Cache article content twice as long

// Headers to mimic a browser request
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

const contentExtractorService = {
  // Get cache for clearing
  getCache() {
    return cache;
  },
  
  // Extract content from URL
  async extractContent(url) {
    const cacheKey = `content_${url}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      console.log(`Downloading content from: ${url}`);
      
      // Set request options
      const timeout = config.requests?.timeout || 12000;
      const maxContentLength = config.requests?.maxContentLength || 5 * 1024 * 1024;
      
      // Download the HTML content
      const response = await axios.get(url, { 
        headers,
        timeout,
        maxContentLength,
        responseType: 'text'
      });
      
      const html = response.data;
      
      // Parse HTML
      const $ = cheerio.load(html);
      
      // Remove unwanted elements
      $('script, style, nav, footer, iframe, svg, form, button, input, noscript, [role="banner"], [role="navigation"]').remove();
      
      // Extract title
      const title = $('title').text().trim() || '';
      
      // Extract main content with html-to-text
      const mainContent = convert($.html('body'), {
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ],
        wordwrap: false,
        preserveNewlines: true,
        singleNewLineParagraphs: true
      });
      
      // Truncate content to avoid excessive token usage (about 5000 tokens max)
      const truncatedContent = mainContent.substring(0, 12000);
      
      const result = {
        title,
        content: truncatedContent
      };
      
      // Cache the content
      cache.set(cacheKey, result);
      console.log(`Extracted ${truncatedContent.length} chars of content`);
      
      return result;
    } catch (error) {
      console.error(`Error extracting content from ${url}:`, error.message);
      return {
        title: '',
        content: `Failed to extract content: ${error.message}`
      };
    }
  }
};

module.exports = contentExtractorService;