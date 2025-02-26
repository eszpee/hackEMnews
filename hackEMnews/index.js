require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config/default');
const apiRoutes = require('./src/routes/api');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.render('index', { title: 'HackEM News' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});