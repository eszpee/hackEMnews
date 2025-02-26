const { OpenAI } = require('openai');
const config = require('../../config/default');
const NodeCache = require('node-cache');
const contentExtractorService = require('./contentExtractorService');

// Cache setup
const cache = new NodeCache({ stdTTL: config.cache.ttl });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Helper function to balance articles from different sources
function balanceArticleSources(articles) {
  // Group articles by source
  const sourceGroups = {};
  
  articles.forEach(article => {
    const source = article.source || 'unknown';
    if (!sourceGroups[source]) {
      sourceGroups[source] = [];
    }
    sourceGroups[source].push(article);
  });
  
  console.log(`Article count by source: ${Object.keys(sourceGroups).map(s => `${s}: ${sourceGroups[s].length}`).join(', ')}`);
  
  // If we only have one source, just return the articles
  if (Object.keys(sourceGroups).length <= 1) {
    console.log('Only one source found, skipping balancing');
    return articles;
  }
  
  // Log detailed source breakdown
  console.log('Article breakdown by source before balancing:');
  Object.keys(sourceGroups).forEach(source => {
    console.log(`${source}: ${sourceGroups[source].length} articles, first article ID: ${sourceGroups[source][0]?.id || 'None'}`);
  });
  
  // Sort each group by relevance score
  Object.keys(sourceGroups).forEach(source => {
    sourceGroups[source].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  });
  
  // Take top articles from each source in rounds until we have maxResults
  const balancedArticles = [];
  const maxResults = config.articles.maxResults;
  let currentSourceIndex = 0;
  const sources = Object.keys(sourceGroups);
  
  console.log(`Starting balancing with ${sources.length} sources: ${sources.join(', ')}`);
  console.log(`Will select up to ${maxResults} articles in total`);
  
  let round = 1;
  while (balancedArticles.length < maxResults && sources.some(s => sourceGroups[s].length > 0)) {
    const currentSource = sources[currentSourceIndex];
    
    if (sourceGroups[currentSource].length > 0) {
      const article = sourceGroups[currentSource].shift();
      balancedArticles.push(article);
      console.log(`Round ${round}: Added article from ${currentSource}, ID: ${article.id}, title: ${article.title?.substring(0, 30)}...`);
    } else {
      console.log(`Round ${round}: Source ${currentSource} has no more articles`);
    }
    
    // Move to next source
    currentSourceIndex = (currentSourceIndex + 1) % sources.length;
    if (currentSourceIndex === 0) {
      round++;
    }
  }
  
  // Sort by relevance score
  balancedArticles.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  
  // Log final balanced article breakdown by source
  const finalSourceCount = {};
  balancedArticles.forEach(article => {
    const source = article.source || 'unknown';
    finalSourceCount[source] = (finalSourceCount[source] || 0) + 1;
  });
  
  console.log('Final balanced articles by source:');
  Object.keys(finalSourceCount).forEach(source => {
    console.log(`${source}: ${finalSourceCount[source]} articles`);
  });
  
  return balancedArticles;
}

const openaiService = {
  // Get cache for clearing
  getCache() {
    return cache;
  },
  // Filter articles for Engineering Management relevance
  async filterArticlesForEM(articles) {
    const cacheKey = 'filtered_articles';
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      // Log the number of articles we're processing
      console.log(`Processing ${articles.length} articles from HN for EM relevance`);
      
      // Prepare article data for OpenAI - first with basic info
      const basicArticleData = articles.map(article => ({
        id: article.id,
        title: article.title,
        url: article.url
      }));
      
      // First filtering pass on titles to select potential candidates
      console.log('Performing initial filtering based on titles...');
      const initialResponse = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an assistant that helps identify articles that might be relevant to Engineering Management.
            ${config.targetAudience.prompt}
            
            Return a JSON object with an "articles" array containing the IDs of articles that could be relevant to engineering management based on their titles.
            
            Include articles about:
            - Leadership and team management
            - Technical decision making and architecture
            - Engineering processes and methodologies
            - Career development for engineers
            - Communication and soft skills
            - Managing technical projects
            - Engineering culture and team dynamics
            
            Be thorough but selective - include all potentially relevant articles but filter out those clearly unrelated to engineering management.
            
            Return valid JSON that can be parsed, with no other text.`
          },
          {
            role: 'user',
            content: `Here's a list of articles. Please identify which ones might be relevant to Engineering Management based on their titles:
            ${JSON.stringify(basicArticleData, null, 2)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      // Parse the response to get candidate articles
      const initialResult = JSON.parse(initialResponse.choices[0].message.content);
      const candidateIds = initialResult.articles || [];
      
      console.log(`Initial filtering identified ${candidateIds.length} potential candidates`);
      
      // If no candidates, return empty array
      if (candidateIds.length === 0) {
        console.log('No potential candidates found, returning empty array');
        cache.set(cacheKey, []);
        return [];
      }
      
      // Get candidate articles with full data
      const candidateArticles = candidateIds
        .map(id => articles.find(a => a.id === parseInt(id) || a.id === id))
        .filter(article => article !== undefined);
      
      // Download content for candidate articles (in parallel)
      console.log('Downloading content for candidate articles...');
      const articlesWithContent = await Promise.all(
        candidateArticles.map(async (article) => {
          try {
            const extractedContent = await contentExtractorService.extractContent(article.url);
            // Truncate content to avoid token limits
            const truncatedContent = extractedContent.content.substring(0, 2000);
            return {
              id: article.id,
              title: article.title,
              url: article.url,
              contentPreview: truncatedContent
            };
          } catch (error) {
            console.error(`Error extracting content for article ${article.id}:`, error.message);
            return {
              id: article.id,
              title: article.title,
              url: article.url,
              contentPreview: "Failed to extract content"
            };
          }
        })
      );
      
      // Prepare the enhanced article data for OpenAI
      console.log('Sample of articles with content being sent to OpenAI:', 
        articlesWithContent.slice(0, 2).map(a => ({
          id: a.id,
          title: a.title,
          contentPreviewLength: a.contentPreview.length
        }))
      );
      
      // Ask OpenAI to filter and rank articles with relevance scores
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an assistant that helps filter and rank articles based on their relevance to Engineering Management.
            ${config.targetAudience.prompt}
            Return a JSON object with an "articles" array containing objects with "id" and "relevanceScore" properties.
            The relevanceScore should be a number between 0 and 1 indicating how relevant the article is to engineering management.
            Only include articles that are at least somewhat relevant to engineering management.
            Rank the articles by relevanceScore, with the most relevant first.
            Return valid JSON that can be parsed, with no other text.`
          },
          {
            role: 'user',
            content: `Here's a list of articles with their content previews. Please filter and rank them based on their relevance to Engineering Management:
            ${JSON.stringify(articlesWithContent, null, 2)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      console.log('OpenAI response received');
      
      // Parse the response to get relevant articles with scores
      const result = JSON.parse(response.choices[0].message.content);
      console.log('Parsed OpenAI response:', result);
      
      // Log sources of the input articles for debugging
      const sourceCount = {};
      articles.forEach(article => {
        const source = article.source || 'unknown';
        sourceCount[source] = (sourceCount[source] || 0) + 1;
      });
      console.log('Input article source counts:', sourceCount);
      
      // Get articles with relevance scores above the threshold
      const minRelevanceScore = config.articles.minRelevanceScore;
      console.log(`Filtering for articles with relevance score >= ${minRelevanceScore}`);
      
      const relevantArticlesData = (result.articles || [])
        .filter(item => (item.relevanceScore || 0) >= minRelevanceScore);
      
      console.log(`Found ${relevantArticlesData.length} articles above the relevance threshold`);
      
      // Get the full article data and add relevance scores
      const relevantArticles = relevantArticlesData
        .map(item => {
          const article = articles.find(a => a.id === parseInt(item.id) || a.id === item.id);
          if (article) {
            // Log the article before adding relevance score
            console.log(`Found article with id=${article.id}, source=${article.source || 'unknown'}`);
            
            // Add relevance score
            const articleWithScore = {
              ...article,
              relevanceScore: item.relevanceScore
            };
            
            console.log(`Added relevance score ${item.relevanceScore} to article ${article.title?.substring(0, 40)}...`);
            return articleWithScore;
          }
          console.log(`❌ No matching article found for id=${item.id}`);
          return null;
        })
        .filter(article => article !== null);
      
      // Log the number of articles by source after adding relevance scores
      const relevantSourceCount = {};
      relevantArticles.forEach(article => {
        const source = article.source || 'unknown';
        relevantSourceCount[source] = (relevantSourceCount[source] || 0) + 1;
      });
      console.log('Relevant articles by source:', relevantSourceCount);
      
      console.log(`Retrieved ${relevantArticles.length} full article objects from IDs`);
      
      // If we got no relevant articles, use the top 10 as fallback
      if (relevantArticles.length === 0) {
        console.log('No relevant articles found, using top 10 as fallback');
        // Add default relevance score to fallback articles
        const fallbackArticles = articles.slice(0, 10).map(article => ({
          ...article,
          relevanceScore: 0.5 // Add default relevance score
        }));
        cache.set(cacheKey, fallbackArticles);
        return fallbackArticles;
      }
      
      // Balance sources in the final result
      const balancedArticles = balanceArticleSources(relevantArticles);
      console.log(`After balancing sources, selected ${balancedArticles.length} articles`);
      
      // Cache the results
      cache.set(cacheKey, balancedArticles);
      
      return balancedArticles;
    } catch (error) {
      console.error('Error filtering articles with OpenAI:', error);
      
      // If there's an error, return first 10 articles unfiltered with default relevance
      console.log('Returning first 10 articles unfiltered due to error');
      return articles.slice(0, 10).map(article => ({
        ...article,
        relevanceScore: 0.5 // Add default relevance score
      }));
    }
  },
  
  // Generate a summary for an article
  async generateSummary(article) {
    const cacheKey = `summary_${article.id}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    try {
      console.log(`Generating summary for article: ${article.title}`);
      
      // Download and extract article content
      let articleContent = "No content available";
      let articleTitle = article.title;
      
      try {
        // Download article content
        const extractedContent = await contentExtractorService.extractContent(article.url);
        articleContent = extractedContent.content || "No content available";
        
        // Use extracted title if available and better than HN title
        if (extractedContent.title && extractedContent.title.length > articleTitle.length) {
          articleTitle = extractedContent.title;
        }
        
        console.log(`Content extracted (${articleContent.length} chars) for article: ${article.title}`);
      } catch (extractError) {
        console.error(`Failed to extract content for ${article.url}:`, extractError);
      }
      
      // Prepare content for OpenAI - truncate if too long
      const maxContentLength = 10000; // Approximately 2500 tokens
      let truncatedContent = articleContent;
      
      if (articleContent.length > maxContentLength) {
        // Keep the first part, some from the middle, and the end
        const firstPart = articleContent.substring(0, maxContentLength * 0.5); 
        const lastPart = articleContent.substring(articleContent.length - maxContentLength * 0.2);
        truncatedContent = `${firstPart}\n\n[...Content truncated...]\n\n${lastPart}`;
      }
      
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an assistant that generates concise summaries of articles for Engineering Managers.
            ${config.targetAudience.prompt}
            
            Create a 2-3 sentence summary that explains the key points of this article and their relevance to engineering management.
            
            If the article contains information genuinely relevant to engineering managers, highlight these points specifically. 
            
            If the article has no clear relevance to engineering management after careful review, summarize it objectively without trying to force a connection.`
          },
          {
            role: 'user',
            content: `Please summarize this article and explain why it's relevant to engineering managers:
            Title: ${articleTitle}
            URL: ${article.url}
            
            Article Content:
            ${truncatedContent}`
          }
        ],
        temperature: 0.5,
        max_tokens: 150
      });
      
      const summary = response.choices[0].message.content.trim();
      console.log(`Generated summary for "${article.title}": ${summary.substring(0, 40)}...`);
      
      // Cache the summary
      cache.set(cacheKey, summary);
      
      return summary;
    } catch (error) {
      console.error(`Error generating summary for article ${article.id}:`, error);
      // Fallback summary in case of error
      const fallbackSummary = `Summary for "${article.title}" is unavailable. This article may be relevant to engineering management based on its title.`;
      return fallbackSummary;
    }
  }
};

module.exports = openaiService;