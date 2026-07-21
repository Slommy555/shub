# Session Progress

## Budget Fixes Round 2
- [x] Fix 1 — Strict calendar months (no 30-day bins) — already satisfied by periodForCursor; audited, no bin logic exists
- [ ] Fix 2 — Period persistence: amounts isolated per period (source Overview from budget_allocations, not persistent group.amount)
- [ ] Fix 3 — Savings cancellation order-independent (shared netAmount util, Covered/remainder display)
- [ ] Fix 3b — Overview shows remainder after savings; only remainder counts toward totals
- [ ] Fix 4 — Separate Recurring Fixed Costs from Scheduled Expenses
- [ ] Fix 4b — Scheduled Expenses section + budget_scheduled_expenses table
- [ ] Fix 5 — Credit Card Payments as simple weekly line items + budget_credit_cards table
- [ ] Summary calculations updated (monthly/weekly remaining, CC shown separately)
- [ ] Build passing + git pushed
