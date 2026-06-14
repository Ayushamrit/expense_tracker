# AI Usage Log

## AI Tools Used
- Google DeepMind Gemini (Advanced Agentic Coding Assistant)

## Key Prompts Used
- "Build a Node.js/Express backend that parses a messy CSV using `papaparse` and `date-fns` to detect formatting anomalies without crashing."
- "Write a React component `ImportData.jsx` that accepts a CSV file upload, displays an anomaly log summary, and implements an approval workflow."
- "Create a greedy debt simplification algorithm in Javascript that takes a matrix of balances and outputs the minimum number of transactions needed to settle all debts."

## Mistakes the AI Made and How They Were Caught/Fixed

1. **AI produced a `mkdir` command that failed on Windows.**
   - *What happened*: The AI tried to run `mkdir -p C:\...\routes C:\...\controllers` which works in Bash but fails in PowerShell due to positional parameters.
   - *How it was caught*: The background task logs threw an `InvalidArgument: [mkdir]` exception.
   - *What was changed*: Instead of relying on `mkdir`, I utilized native file-writing tools which inherently create parent directories automatically when writing new code files.

2. **AI initially overlooked the exact logic needed for splitting.**
   - *What happened*: When drafting the DB schema, the AI initially just stored the expense amount and tried to calculate splits dynamically on the frontend.
   - *How it was caught*: During the creation of the Decision Log, reviewing Rohan's explicit requirement ("No magic numbers, I want to see exactly which expenses make that up") revealed that dynamic calculation loses strict traceability.
   - *What was changed*: Re-architected the schema to include an `expense_splits` table to hardcode the exact `amount_owed` per user per expense.

3. **AI failed to handle foreign currencies natively in calculation.**
   - *What happened*: The AI's first draft of the CSV parser simply summed USD and INR values together.
   - *How it was caught*: Reviewing Priya's complaint ("Half the trip was in dollars... that can't be right").
   - *What was changed*: Modified the balance calculation logic in `routes/balances.js` to multiply the raw amount by an `exchange_rate` before aggregating totals.
