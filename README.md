# Spreetail Shared Expenses App

A full-stack web application designed to help flatmates manage their shared expenses, featuring a robust CSV import module that automatically detects and resolves real-world data anomalies.

## Features

- **Robust CSV Import**: Ingests messy spreadsheets and automatically handles anomalies (duplicates, currency conversions, invalid formats).
- **Approval Workflow (Meera's Request)**: Generates a detailed "Import Report" summarizing all anomalies and proposed fixes, requiring user approval before saving to the database.
- **Simplified Balances (Aisha's Request)**: Calculates a minimized set of transactions so everyone knows exactly who pays whom with one single number.
- **Transparent Breakdowns (Rohan's Request)**: Users can click on their balance to see the exact breakdown of which expenses constitute their debt.
- **Time-based Memberships (Sam's Request)**: Tracks when members joined/left to ensure they aren't charged for expenses outside their tenancy.
- **Multi-currency Support (Priya's Request)**: Converts USD expenses into INR automatically.

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MySQL installed and running locally.

### 1. Database Configuration
1. Open `backend/.env`.
2. Ensure your MySQL credentials are correct (`DB_USER`, `DB_PASSWORD`). The default database name is `spreetail_expenses`.
3. You **do not** need to create the database or tables manually. The backend will automatically create them on startup.

### 2. Run the Backend
Open a terminal and run:
```bash
cd backend
npm install
node server.js
```
You should see `Server running on port 5000` and `Database connection ready`.

### 3. Run the Frontend
Open a new terminal and run:
```bash
cd frontend
npm install
npm run dev
```
The app will open in your browser (usually at `http://localhost:5173`).

### 4. Import the Data
Click the "Import CSV" button and upload the provided `expenses_export.csv` to see the anomaly resolution workflow in action.

## AI Usage
I used an AI assistant to build this application. See `AI_USAGE.md` for a detailed breakdown of prompts and corrections.


## Live URLs
- Frontend: Vercel
- Backend: Render
- DB: Railway
