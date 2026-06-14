const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // 1. Get all members
    const [members] = await pool.query(`
      SELECT u.id, u.name, gm.left_at 
      FROM group_members gm 
      JOIN users u ON gm.user_id = u.id 
      WHERE gm.group_id = ?
    `, [groupId]);
    
    const balances = {};
    const detailedDebts = {}; 
    const stats = {};
    
    members.forEach(m => {
      balances[m.id] = 0;
      stats[m.id] = { total_paid: 0, total_owed: 0 };
      detailedDebts[m.id] = [];
    });

    // 2. Process all expenses
    const [expenses] = await pool.query(`
      SELECT id, amount, currency, exchange_rate, paid_by, description, date 
      FROM expenses 
      WHERE group_id = ?
    `, [groupId]);

    for (const exp of expenses) {
      const expTotalInINR = parseFloat(exp.amount) * parseFloat(exp.exchange_rate);
      
      if (balances[exp.paid_by] !== undefined) {
        balances[exp.paid_by] += expTotalInINR;
        stats[exp.paid_by].total_paid += expTotalInINR;
      }

      // 3. Process splits for this expense
      const [splits] = await pool.query(`
        SELECT user_id, amount_owed 
        FROM expense_splits 
        WHERE expense_id = ?
      `, [exp.id]);

      splits.forEach(split => {
        const owedInINR = parseFloat(split.amount_owed) * parseFloat(exp.exchange_rate);
        if (balances[split.user_id] !== undefined) {
          balances[split.user_id] -= owedInINR;
          stats[split.user_id].total_owed += owedInINR;
          
          if (split.user_id !== exp.paid_by) {
            detailedDebts[split.user_id].push({
               expense_id: exp.id,
               description: exp.description,
               date: exp.date,
               owed_to: exp.paid_by,
               amount: owedInINR
            });
          }
        }
      });
    }

    // 4. Process settlements
    const [settlements] = await pool.query(`
      SELECT paid_by, paid_to, amount FROM settlements WHERE group_id = ?
    `, [groupId]);

    settlements.forEach(settle => {
      const amt = parseFloat(settle.amount);
      if (balances[settle.paid_by] !== undefined) {
          balances[settle.paid_by] += amt;
          stats[settle.paid_by].total_paid += amt;
      }
      if (balances[settle.paid_to] !== undefined) {
          balances[settle.paid_to] -= amt;
          stats[settle.paid_to].total_owed += amt;
      }
    });

    // 5. Simplify Debts
    const simplifiedDebts = simplifyDebts(balances, members);

    res.json({
      balances: Object.keys(balances).map(id => {
        const m = members.find(m => m.id == id);
        return {
          user_id: id,
          name: m?.name,
          net_balance: balances[id].toFixed(2),
          total_paid: stats[id].total_paid.toFixed(2),
          total_owed: stats[id].total_owed.toFixed(2),
          left_at: m?.left_at
        };
      }),
      simplified_debts: simplifiedDebts,
      detailed_debts: detailedDebts
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function simplifyDebts(balances, members) {
  const debtors = [];
  const creditors = [];
  
  Object.keys(balances).forEach(id => {
    if (balances[id] < -0.01) debtors.push({ id, amount: Math.abs(balances[id]) });
    else if (balances[id] > 0.01) creditors.push({ id, amount: balances[id] });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    
    transactions.push({
      from: debtor.id,
      from_name: members.find(m => m.id == debtor.id)?.name,
      to: creditor.id,
      to_name: members.find(m => m.id == creditor.id)?.name,
      amount: amount.toFixed(2)
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) d++;
    if (creditor.amount < 0.01) c++;
  }

  return transactions;
}

module.exports = router;
