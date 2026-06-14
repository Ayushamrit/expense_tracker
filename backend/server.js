const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./database');

const importRoutes = require('./routes/import');
const groupsRoutes = require('./routes/groups');
const expensesRoutes = require('./routes/expenses');
const balancesRoutes = require('./routes/balances');
const usersRoutes = require('./routes/users');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow local dev + Vercel production frontend
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o.trim()))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Initialize DB on start
initializeDatabase().then(() => {
  console.log("Database connection ready.");
});

app.use('/api/import', importRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/balances', balancesRoutes);
app.use('/api/users', usersRoutes);

// Basic test route
app.get('/', (req, res) => {
  res.send('Spreetail Shared Expenses API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
