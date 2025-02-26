# HackEM News

A curated news aggregator for Engineering Managers that pulls relevant content from multiple sources including Hacker News and Reddit r/EngineeringManagers.

## Features

- Fetches articles from Hacker News and Reddit
- Uses AI to filter content relevant to Engineering Managers
- Scores articles based on relevance to engineering management topics
- Provides summaries of articles for quick review
- Balances content from multiple sources

## Tech Stack

- Node.js with Express
- OpenAI API for content filtering and summarization
- EJS templates for server-side rendering
- Bootstrap for responsive design
- Axios for HTTP requests
- Node-cache for in-memory caching

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/hackEMnews.git
   cd hackEMnews
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create environment file
   ```bash
   cp hackEMnews/.env.example hackEMnews/.env
   ```

4. Add your OpenAI API key to the `.env` file

5. Start the development server
   ```bash
   cd hackEMnews
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Configuration

You can customize the app behavior by editing the `config/default.js` file:

- Change which sources are enabled
- Adjust relevance thresholds
- Configure API parameters
- Modify cache duration
- Customize target audience parameters

## License

This project is licensed under the MIT License - see the LICENSE file for details.