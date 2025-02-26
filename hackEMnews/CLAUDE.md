# HackEM News Development Guide

## Build & Run Commands
```
npm start             # Run production server
npm run dev           # Run development server with auto-reload
npm run dev:debug     # Run with debug logging enabled
```

## Code Style Guidelines

### Architecture
- Express.js server with EJS templates for views
- Modular services: `hackerNewsService`, `openaiService`, `contentExtractorService`
- RESTful API routes in `src/routes/api.js`

### JavaScript Conventions
- Use `const` for imports and variables that won't be reassigned
- Use async/await for asynchronous operations
- Implement proper error handling with try/catch blocks
- Use meaningful variable/function names in camelCase
- Log errors with context (`console.error('Error message:', error)`)

### Caching Strategy
- Use NodeCache with appropriate TTL for API responses
- Cache at service level (not controller level)
- Handle cache invalidation via dedicated endpoint

### API Design
- Consistent error handling with appropriate status codes
- Response format: JSON objects with clear property names
- Log request parameters and response sizes for debugging

### Frontend
- Bootstrap for responsive layout
- Centralized error handling for fetch operations
- Use fetch API with async/await