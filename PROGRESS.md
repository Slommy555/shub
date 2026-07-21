# Session Progress

## Budget Fixes Round 2
- [x] Fix 1 — Strict calendar months (no 30-day bins) — already satisfied by periodForCursor; audited, no bin logic exists
- [x] Fix 2 — Period persistence: amounts isolated per period (Overview sources budget_allocations, not persistent group.amount)
- [x] Fix 3 — Savings cancellation order-independent (shared savingsOffset util, Covered/remainder display)
- [x] Fix 3b — Overview shows remainder after savings; only remainder counts toward totals
- [x] Fix 4 — Separate Recurring Fixed Costs from Scheduled Expenses
- [x] Fix 4b — Scheduled Expenses section + budget_scheduled_expenses table
- [x] Fix 5 — Credit Card Payments as simple weekly line items + budget_credit_cards table
- [x] Summary calculations updated (monthly/weekly remaining, CC shown separately)
- [x] Build passing + git pushed
