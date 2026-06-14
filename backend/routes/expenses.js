const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Create an expense and its splits
router.post('/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { description, amount, currency, exchange_rate, date, paid_by, split_type, notes, splits } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userIds = [paid_by];
    if (splits && splits.length > 0) {
      splits.forEach(s => userIds.push(s.user_id));
    }
    const [inactive] = await connection.query(`
      SELECT u.name FROM group_members gm 
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.user_id IN (?) AND gm.left_at IS NOT NULL AND gm.left_at <= ?
    `, [groupId, userIds, date]);
    
    if (inactive.length > 0) {
      throw new Error(`Cannot add expense involving inactive users: ${inactive.map(u => u.name).join(', ')}`);
    }

    const [expenseRes] = await connection.query(`
      INSERT INTO expenses (group_id, description, amount, currency, exchange_rate, date, paid_by, split_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [groupId, description, amount, currency || 'INR', exchange_rate || 1.0, date, paid_by, split_type, notes]);

    const expenseId = expenseRes.insertId;

    if (splits && splits.length > 0) {
      for (const split of splits) {
        await connection.query(`
          INSERT INTO expense_splits (expense_id, user_id, amount_owed)
          VALUES (?, ?, ?)
        `, [expenseId, split.user_id, split.amount_owed]);
      }
    }

    await connection.commit();
    res.json({ success: true, expenseId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Import processed CSV data
router.post('/group/:groupId/import', async (req, res) => {
  const { groupId } = req.params;
  const { expenses } = req.body; 
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Ensure group exists
    const [groups] = await connection.query('SELECT id FROM groups_table WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      await connection.query('INSERT INTO groups_table (id, name) VALUES (?, ?)', [groupId, 'Flatmates']);
    }

    let importedCount = 0;
    
    for (const exp of expenses) {
      let [users] = await connection.query('SELECT id FROM users WHERE name = ?', [exp.paid_by]);
      let payerId;
      if (users.length > 0) {
        payerId = users[0].id;
      } else {
        const [uRes] = await connection.query('INSERT INTO users (name, email) VALUES (?, ?)', [exp.paid_by, `${exp.paid_by.replace(/\\s/g,'').toLowerCase()}@example.com`]);
        payerId = uRes.insertId;
      }
      
      await connection.query('INSERT IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)', [groupId, payerId, exp.date || new Date()]);
      
      const rate = exp.currency === 'USD' ? 83.0 : 1.0;
      
      if (exp.split_type === 'settlement') {
         let paidToName = exp.split_with ? exp.split_with.split(';')[0].trim() : null;
         let paidToId = null;
         if (paidToName) {
            let [toUsers] = await connection.query('SELECT id FROM users WHERE name = ?', [paidToName]);
            if (toUsers.length > 0) {
                paidToId = toUsers[0].id;
            } else {
                const [uRes] = await connection.query('INSERT INTO users (name, email) VALUES (?, ?)', [paidToName, `${paidToName.replace(/\\s/g,'').toLowerCase()}@example.com`]);
                paidToId = uRes.insertId;
            }
         }
         if (paidToId) {
            await connection.query(`
              INSERT INTO settlements (group_id, paid_by, paid_to, amount, date)
              VALUES (?, ?, ?, ?, ?)
            `, [groupId, payerId, paidToId, exp.amount, exp.date]);
         }
         importedCount++;
         continue;
      }

      const [eRes] = await connection.query(`
        INSERT INTO expenses (group_id, description, amount, currency, exchange_rate, date, paid_by, split_type, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [groupId, exp.description, exp.amount, exp.currency, rate, exp.date, payerId, exp.split_type, exp.notes]);
      
      const expenseId = eRes.insertId;
      
      const splitWithNames = exp.split_with ? exp.split_with.split(';').map(n => n.trim()) : [];
      let splitUserIds = [];
      
      for (const name of splitWithNames) {
        if (!name) continue;
        let [u] = await connection.query('SELECT id FROM users WHERE name = ?', [name]);
        let uid;
        if (u.length > 0) {
            uid = u[0].id;
        } else {
            const [uRes] = await connection.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, `${name.replace(/\\s/g,'').toLowerCase()}@example.com`]);
            uid = uRes.insertId;
        }
        await connection.query('INSERT IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)', [groupId, uid, exp.date || new Date()]);
        splitUserIds.push(uid);
      }
      
      if (splitUserIds.length === 0) {
         const [members] = await connection.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
         splitUserIds = members.map(m => m.user_id);
      }

      const totalAmount = parseFloat(exp.amount);
      let amountsOwed = {};
      
      if (exp.split_type === 'equal' || !exp.split_type) {
         const perPerson = totalAmount / (splitUserIds.length || 1);
         splitUserIds.forEach(id => amountsOwed[id] = perPerson);
      } else if (exp.split_type === 'percentage' && exp.split_details) {
         const regex = /([a-zA-Z\\s]+)\\s*(\\d+)%/g;
         let match;
         let parsedShares = {};
         let totalPercent = 0;
         while ((match = regex.exec(exp.split_details)) !== null) {
            parsedShares[match[1].trim()] = parseInt(match[2]);
            totalPercent += parseInt(match[2]);
         }
         for (const [name, percent] of Object.entries(parsedShares)) {
            let [u] = await connection.query('SELECT id FROM users WHERE name = ?', [name]);
            if (u.length > 0) amountsOwed[u[0].id] = (totalAmount * (percent / totalPercent));
         }
      } else if (exp.split_type === 'share' && exp.split_details) {
         const regex = /([a-zA-Z\\s]+)\\s*(\\d+)/g;
         let match;
         let parsedShares = {};
         let totalShares = 0;
         while ((match = regex.exec(exp.split_details)) !== null) {
            parsedShares[match[1].trim()] = parseInt(match[2]);
            totalShares += parseInt(match[2]);
         }
         for (const [name, share] of Object.entries(parsedShares)) {
            let [u] = await connection.query('SELECT id FROM users WHERE name = ?', [name]);
            if (u.length > 0) amountsOwed[u[0].id] = (totalAmount * (share / totalShares));
         }
      } else if (exp.split_type === 'unequal' && exp.split_details) {
         const regex = /([a-zA-Z\\s]+)\\s*(\\d+)/g;
         let match;
         while ((match = regex.exec(exp.split_details)) !== null) {
            const name = match[1].trim();
            const amt = parseFloat(match[2]);
            let [u] = await connection.query('SELECT id FROM users WHERE name = ?', [name]);
            if (u.length > 0) amountsOwed[u[0].id] = amt;
         }
      }
      
      for (const [uid, amt] of Object.entries(amountsOwed)) {
        await connection.query(`
          INSERT INTO expense_splits (expense_id, user_id, amount_owed)
          VALUES (?, ?, ?)
        `, [expenseId, uid, amt]);
      }
      
      importedCount++;
    }

    await connection.commit();
    res.json({ success: true, importedCount });
  } catch (error) {
    await connection.rollback();
    console.error("Import Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Get expenses for a group
router.get('/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    const [expenses] = await pool.query(`
      SELECT e.*, u.name as paid_by_name 
      FROM expenses e 
      JOIN users u ON e.paid_by = u.id 
      WHERE e.group_id = ? 
      ORDER BY e.date DESC
    `, [groupId]);

    for (let exp of expenses) {
      const [splits] = await pool.query(`
        SELECT es.user_id, es.amount_owed, u.name 
        FROM expense_splits es
        JOIN users u ON es.user_id = u.id
        WHERE es.expense_id = ?
      `, [exp.id]);
      exp.splits = splits;
    }

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
