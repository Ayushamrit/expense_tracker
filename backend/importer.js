const fs = require('fs');
const Papa = require('papaparse');
const { parse, isValid, parseISO } = require('date-fns');

// Helper to clean amounts
function cleanAmount(val) {
  if (!val) return 0;
  // Remove spaces, commas, and handle negative signs
  let cleaned = val.toString().replace(/,/g, '').replace(/\s/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

// Helper to parse messy dates
function parseDate(dateStr) {
  if (!dateStr) return null;
  dateStr = dateStr.trim();
  
  // Try YYYY-MM-DD
  let d = parseISO(dateStr);
  if (isValid(d)) return d;

  // Try DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Is it MM/DD/YYYY or DD/MM/YYYY? Assume DD/MM/YYYY
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      if (isValid(d)) return d;
    }
  }

  // Try formats like "Mar 14" (assuming year 2026 based on context)
  d = new Date(`${dateStr}, 2026`);
  if (isValid(d)) return d;

  return null;
}

function processCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const rows = results.data;
        const anomalies = [];
        const cleanedData = [];

        // Track seen expenses for duplicate detection
        const seenExpenses = new Map();

        rows.forEach((row, index) => {
          const rowNum = index + 2; // +1 for 0-index, +1 for header
          
          let { date, description, paid_by, amount, currency, split_type, split_with, split_details, notes } = row;

          // 1. Missing Currency
          if (!currency || currency.trim() === '') {
            currency = 'INR';
            anomalies.push({ row: rowNum, issue: 'Missing currency', resolution: 'Defaulted to INR', field: 'currency', original: row.currency, fixed: currency });
          }

          // 2. Formatting in amount
          const parsedAmount = cleanAmount(amount);
          if (parsedAmount !== parseFloat(amount)) {
            anomalies.push({ row: rowNum, issue: 'Amount contains invalid characters (e.g. commas, spaces)', resolution: `Cleaned amount to ${parsedAmount}`, field: 'amount', original: amount, fixed: parsedAmount });
          }

          // 3. Zero amount
          if (parsedAmount === 0) {
            anomalies.push({ row: rowNum, issue: 'Amount is 0', resolution: 'Skipped row entirely', field: 'amount', original: amount, action: 'skip' });
            return; // skip this row
          }

          // 4. Negative amount
          let isRefund = false;
          let finalAmount = parsedAmount;
          if (parsedAmount < 0) {
            isRefund = true;
            finalAmount = Math.abs(parsedAmount);
            anomalies.push({ row: rowNum, issue: 'Negative amount', resolution: 'Treated as a refund', field: 'amount', original: amount, fixed: finalAmount, isRefund: true });
          }

          // 5. Settlement logged as expense
          let isSettlement = false;
          if (!split_type && !split_details) {
             isSettlement = true;
             anomalies.push({ row: rowNum, issue: 'Settlement logged as expense (no split_type)', resolution: 'Marked as settlement', field: 'split_type', original: split_type, fixed: 'settlement' });
          }

          // 6. Conflicting split type and details
          if (split_type === 'equal' && split_details) {
            if (split_details.includes('%') || split_details.match(/\b\d+\b/)) {
              anomalies.push({ row: rowNum, issue: 'Split type is equal but detailed split rules provided', resolution: 'Prioritizing detailed rules over equal split', field: 'split_type', original: split_type, fixed: 'custom' });
            }
          }

          // 7. Percentage mismatch
          if (split_type === 'percentage' && split_details) {
            const matches = split_details.match(/(\d+)%/g);
            if (matches) {
              const totalPercent = matches.reduce((sum, match) => sum + parseInt(match), 0);
              if (totalPercent !== 100) {
                 anomalies.push({ row: rowNum, issue: `Percentages sum to ${totalPercent}% instead of 100%`, resolution: 'Will normalize to 100% during processing', field: 'split_details', original: split_details });
              }
            }
          }

          // 8. Dates format variation
          const parsedDate = parseDate(date);
          const dateStrFixed = parsedDate ? parsedDate.toISOString().split('T')[0] : null;
          if (date !== dateStrFixed) {
            anomalies.push({ row: rowNum, issue: 'Inconsistent date format', resolution: `Parsed as ${dateStrFixed}`, field: 'date', original: date, fixed: dateStrFixed });
          }

          // Prepare clean record
          const cleanRow = {
            _rowNum: rowNum,
            date: dateStrFixed,
            description: (description || '').trim(),
            paid_by: (paid_by || '').trim(),
            amount: finalAmount,
            currency: currency.trim(),
            split_type: isSettlement ? 'settlement' : (split_type || '').trim(),
            split_with: (split_with || '').trim(),
            split_details: (split_details || '').trim(),
            notes: (notes || '').trim(),
            isRefund
          };

          // 9. Duplicates detection
          const key = `${cleanRow.date}_${cleanRow.amount}_${cleanRow.paid_by}_${cleanRow.description.toLowerCase().replace(/[^a-z]/g, '')}`;
          if (seenExpenses.has(key)) {
            anomalies.push({ row: rowNum, issue: 'Duplicate entry detected', resolution: 'Skipped duplicate entry', field: 'row', original: 'duplicate', action: 'skip' });
            return; // skip
          } else {
            seenExpenses.set(key, cleanRow);
          }

          cleanedData.push(cleanRow);
        });

        // 10. Conflict detection (e.g. Thalassa dinner logged by two people)
        // Check for same date, similar description, different payer/amount
        for (let i = 0; i < cleanedData.length; i++) {
          for (let j = i + 1; j < cleanedData.length; j++) {
            const r1 = cleanedData[i];
            const r2 = cleanedData[j];
            if (r1.date === r2.date) {
              // Very simple similarity check
              const desc1 = r1.description.toLowerCase().replace(/[^a-z]/g, '');
              const desc2 = r2.description.toLowerCase().replace(/[^a-z]/g, '');
              if (desc1.includes(desc2) || desc2.includes(desc1)) {
                 // It's a conflict
                 anomalies.push({ 
                   row: r2._rowNum, 
                   issue: 'Conflicting entry (similar description, different payer/amount)', 
                   resolution: 'Flagged for user review', 
                   field: 'conflict', 
                   original: `Conflicts with row ${r1._rowNum}`,
                   action: 'review'
                 });
                 // We will mark r2 as needs_review
                 r2.needs_review = true;
              }
            }
          }
        }

        resolve({ data: cleanedData, anomalies });
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  processCSV
};
