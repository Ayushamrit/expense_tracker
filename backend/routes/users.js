const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../database');

// Get all users
router.get('/', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email FROM users ORDER BY name ASC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });
  
  try {
    let [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: "Email already in use" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [uRes] = await pool.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);
    res.json({ id: uRes.insertId, name, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  
  try {
    let [users] = await pool.query('SELECT id, name, email, password FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json({ error: "Invalid credentials" });

    const user = users[0];
    if (!user.password) return res.status(400).json({ error: "Please log in using your original method or reset password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
