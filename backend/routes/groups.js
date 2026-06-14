const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Get all groups
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM groups_table');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new group
router.post('/', async (req, res) => {
  const { name } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO groups_table (name) VALUES (?)', [name]);
    res.json({ id: result.insertId, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get members of a group
router.get('/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, gm.joined_at, gm.left_at 
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `, [id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add member to group
router.post('/:id/members', async (req, res) => {
  const { id } = req.params;
  const { name, email, joined_at } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Check if user exists, else create
    let [users] = await connection.query('SELECT id FROM users WHERE email = ? OR name = ?', [email || '', name]);
    let userId;
    if (users.length > 0) {
      userId = users[0].id;
    } else {
      const [userRes] = await connection.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email || `${name}@example.com`]);
      userId = userRes.insertId;
    }

    const joinDate = joined_at || new Date().toISOString().split('T')[0];
    await connection.query('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at)', [id, userId, joinDate]);
    
    await connection.commit();
    res.json({ success: true, userId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Leave group
router.put('/:groupId/members/:userId/leave', async (req, res) => {
  const { groupId, userId } = req.params;
  
  try {
    const [paid] = await pool.query(`SELECT SUM(amount * exchange_rate) as total FROM expenses WHERE group_id = ? AND paid_by = ?`, [groupId, userId]);
    const totalPaid = parseFloat(paid[0].total || 0);
    
    const [owed] = await pool.query(`
      SELECT SUM(es.amount_owed * e.exchange_rate) as total 
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.group_id = ? AND es.user_id = ?
    `, [groupId, userId]);
    const totalOwed = parseFloat(owed[0].total || 0);

    const [settlementsPaid] = await pool.query(`SELECT SUM(amount) as total FROM settlements WHERE group_id = ? AND paid_by = ?`, [groupId, userId]);
    const sPaid = parseFloat(settlementsPaid[0].total || 0);

    const [settlementsReceived] = await pool.query(`SELECT SUM(amount) as total FROM settlements WHERE group_id = ? AND paid_to = ?`, [groupId, userId]);
    const sReceived = parseFloat(settlementsReceived[0].total || 0);

    const netBalance = (totalPaid + sPaid) - (totalOwed + sReceived);

    if (netBalance < -0.01) {
      return res.status(400).json({ error: "you owe the money to members so first clear all dues before leaving the group" });
    }

    const leaveDate = new Date().toISOString().split('T')[0];
    await pool.query('UPDATE group_members SET left_at = ? WHERE group_id = ? AND user_id = ?', [leaveDate, groupId, userId]);
    res.json({ success: true, left_at: leaveDate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
