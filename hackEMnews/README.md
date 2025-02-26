# HackEM News

HackEM News is an Engineering Management news aggregator that fetches the hottest engineering management-related articles from Hacker News. The application uses OpenAI to filter, rank, and summarize articles relevant to engineering managers, especially focusing on beginner managers coming from a developer background.

## Features

- Fetches top stories from Hacker News
- Uses AI to filter and rank articles based on relevance to Engineering Management
- Generates concise summaries for each article highlighting why it's relevant to EMs
- Caches results to minimize API calls and improve performance
- Responsive web interface for desktop and mobile

## Prerequisites

- Node.js (v16 or higher)
- OpenAI API key
- Docker and Docker Compose (optional, for containerized deployment)

## Installation

### Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your OpenAI API key:
   ```
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key_here
   ```
4. Start the development server:
   ```
   npm run dev
   ```
5. Access the application at `http://localhost:3000`

### Docker Deployment

1. Clone the repository
2. Make sure your OpenAI API key is available as an environment variable
3. Build and start the container:
   ```
   docker-compose up -d
   ```
4. Access the application at `http://localhost:3000`

## Configuration

You can modify the application behavior by editing the configuration in `config/default.js`:

- Change the number of articles to display
- Modify the target audience prompt to focus on different aspects of Engineering Management
- Configure caching behavior
- Update OpenAI model parameters

## Future Enhancements

- Support for additional news sources (Reddit, Twitter, etc.)
- User accounts to save favorite articles
- Sorting options (by date, relevance, etc.)
- Newsletter subscription for daily/weekly digests
- Comment section for each article

## License

ISC