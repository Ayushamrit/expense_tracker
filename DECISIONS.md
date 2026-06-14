# Decision Log

## 1. Database Paradigm: Pre-calculated splits vs Runtime calculation
- **Options Considered**:
  1. Store expenses raw and calculate who owes what on-the-fly via code.
  2. Calculate `expense_splits` explicitly at the time of import/creation and store them in the DB.
- **Decision**: Option 2.
- **Why**: Rohan explicitly requested "No magic numbers." By explicitly storing each `amount_owed` in the database linked to an `expense_id`, we can easily query and display exactly which expenses form a user's total debt. Calculating at runtime makes tracing specific transaction histories much harder and prone to floating-point drift over time.

## 2. Handling Meera's Approval Requirement
- **Options Considered**:
  1. Build a staging database table for unapproved imports.
  2. Process the CSV entirely in memory, return a detailed JSON report to the frontend, and only save to the database when the user clicks "Approve".
- **Decision**: Option 2.
- **Why**: It is significantly less overhead than managing staging tables. The Express route `POST /api/import/upload` parses the CSV, detects anomalies, builds the clean data array, and sends it back to the client. The client reviews it. When approved, the client sends the clean data array to `POST /api/expenses/group/:id/import`.

## 3. Resolving the Thalassa Dinner Conflict
- **Context**: Two users logged the exact same dinner on the same day but with different amounts.
- **Options Considered**:
  1. Keep the higher amount.
  2. Keep the first entry.
  3. Flag it.
- **Decision**: Option 3 (Flag it).
- **Why**: An algorithm cannot definitively know who was right. A silent guess is an explicitly defined failure criteria for this assignment. We flag it during the memory-parse phase and label it `needs_review` so the user (Meera) can handle it manually.

## 4. Technology Stack
- **Decision**: React (Frontend) + Express/Node.js (Backend) + MySQL (Database).
- **Why**: Required to use a relational DB. MySQL is robust and handles constraints well. React provides the flexibility to build a highly interactive, modern UI.
