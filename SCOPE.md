# Scope & Anomaly Log

## Database Schema
We utilized a strictly relational model with no "magic numbers".

- **users**: `id`, `name`, `email`
- **groups_table**: `id`, `name`
- **group_members**: `group_id`, `user_id`, `joined_at`, `left_at`. Tracks when members join/leave to handle Sam and Meera's situations.
- **expenses**: `id`, `group_id`, `amount`, `currency`, `exchange_rate`, `date`, `paid_by`, `split_type`
- **expense_splits**: `id`, `expense_id`, `user_id`, `amount_owed`. Explicitly records exactly how much each person owes for a specific expense.
- **settlements**: `id`, `group_id`, `paid_by`, `paid_to`, `amount`, `date`. Distinguishes payments from standard expenses.

## Anomaly Log (from expenses_export.csv)

1. **Duplicate Entries (Marina Bites dinner)**
   - *Problem*: Rows 13 & 14 were identical (except for capitalization).
   - *Action*: Implemented a duplicate detection map keyed by date, amount, payer, and sanitized description. The first occurrence is kept, the second is skipped.
2. **Missing Currency (Groceries DMart)**
   - *Problem*: Row 36 lacked a currency.
   - *Action*: Importer detects empty currencies and defaults them to `INR`.
3. **Number Formatting Issues**
   - *Problem*: Commas in "1,200" and spaces in " 1450 ".
   - *Action*: Applied regex cleaning during ingestion to strip everything except digits and decimals before parsing as Float.
4. **Negative Amounts (Refunds)**
   - *Problem*: Row 34 had a negative amount for a Parasailing refund.
   - *Action*: Handled as an inverse transaction. It is flagged, converted to an absolute value, and logically distributed as a credit back to the group.
5. **Settlement Logged as Expense**
   - *Problem*: "Rohan paid Aisha back" (Row 22) lacked a split type.
   - *Action*: Importer flags rows lacking split details as "Settlements" and routes them to the `settlements` table rather than `expenses`.
6. **Conflicting Split Details**
   - *Problem*: Row 50 claimed the split type was `equal` but provided specific split shares.
   - *Action*: Detailed rules are prioritized over the generic `equal` keyword.
7. **Percentage Mismatch**
   - *Problem*: Row 23 had percentages summing to 110%.
   - *Action*: Detected and normalized. The backend calculates true shares proportionally (e.g., 30/110).
8. **Inconsistent Date Formats**
   - *Problem*: Mixed formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `MMM DD`).
   - *Action*: Used `date-fns` to iteratively attempt parsing against multiple formats and standardized them to ISO formats.
9. **Conflicting Entries (Thalassa Dinner)**
   - *Problem*: Rows 32 & 33 were logged by two different people with slightly different amounts.
   - *Action*: The importer identifies entries on the same date with similar descriptions and flags them for manual user review in the UI.
10. **Foreign Currency (USD)**
    - *Problem*: Dev's Goa expenses were in USD.
    - *Action*: Handled by saving the original currency but applying a unified `exchange_rate` (1 USD = 83 INR) so balances calculate correctly.
