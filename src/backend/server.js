const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const whatsappRoutes = require('./routes/whatsapp');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - Fix the path to point to src/frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/whatsapp', whatsappRoutes);

// Serve the main HTML file - Fix the path to point to src/frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});