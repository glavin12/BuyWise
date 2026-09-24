# BuyWise — Final Manual Expense Tracker Implementation Plan

> **Historical plan, superseded.** Written before accounts and transfers were removed
> (2026-09-10). It still describes accounts, transfers and an account-based ledger, which
> the code no longer has. Do not treat it as a source of truth: see `AGENTS.md` and
> `docs/`.

## 0. Purpose

Build the **production-quality manual financial tracker foundation** for BuyWise.

This phase is intentionally limited to manual financial management.

The long-term BuyWise product is an AI financial advisor, but the AI service is **not implemented as part of this phase**.

The purpose of this phase is to create a reliable financial ledger that:

1. Works as a useful manual expense tracker today.
2. Produces correct monthly and category-level financial data.
3. Can support the future AI financial advisor without requiring a fundamental redesign.
4. Avoids premature implementation of bank imports, receipt parsing, or other future ingestion systems.

> **Current goal: build the financial foundation, not the future features.**

---

# 1. Scope Boundary

## Build now

- Accounts
- Categories
- Payees
- Transactions
- Manual expenses
- Manual income
- Transfers between own accounts
- Cleared status
- Transaction history/register
- Transaction filtering
- Monthly spending
- Monthly income
- Category-wise spending
- Month-over-month comparison
- Monthly category budgets
- Basic goal/category linkage
- Reliable ledger calculations
- Strong data isolation
- Automated tests for financial invariants

## Explicitly do NOT build now

- AI financial advisor
- LLM tool calling
- AI categorization
- Receipt OCR
- Receipt parsing
- PDF bank-statement parsing
- CSV/XLSX importing
- Direct bank connections
- Automated transaction synchronization
- Merchant-learning systems
- Import approval workflows
- Investment tracking
- Tax features
- Advanced debt management
- Advanced financial planning

These belong to later phases after the manual financial foundation and AI service have matured.

---

# 2. Core Design Principle

The financial ledger must be the **single source of truth**.

```text
Accounts
    │
    └── Transactions
            │
            ├── Income
            ├── Expense
            └── Transfer
                    │
                    ▼
             Financial Analytics
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Monthly   Category   Budget
       totals    spending   actual
```

Do not create duplicate tables such as:

```text
monthly_expenses
category_totals
monthly_spending
budget_spent
```

just to cache financial truth.

Monthly and category values should be derived from the transaction ledger.

This makes the system deterministic and prevents synchronization bugs.

---

# 3. Production Principles

The implementation should prioritize:

- Financial correctness
- Data integrity
- User isolation
- Deterministic calculations
- Clear transaction semantics
- Extensibility
- Testability
- Simple architecture
- Safe migrations

Do not add complexity merely because another financial product has a feature.

When a mature financial product uses a pattern that solves a real ledger problem, research it and adapt the underlying principle rather than copying the entire product.

Useful reference products include:

- YNAB
- Monarch Money
- Copilot Money
- Actual Budget
- Other established financial/accounting systems where relevant

Use official documentation or primary sources when available.

---

# 4. Monetary Representation

## Requirement

Never use floating-point numbers for financial amounts.

Use integer **minor currency units**.

Examples:

```text
$10.50 → 1050 cents
₹10.50 → 1050 paise
€10.50 → 1050 cents
```

Store the integer amount together with the transaction currency.

Recommended conceptual model:

```text
amount: BIGINT
currency: ISO currency code
```

Example:

```text
amount = 1050
currency = USD
```

The API/UI converts the integer into a human-readable currency representation.

### Why

This avoids floating-point precision errors and makes financial calculations deterministic.

Do not introduce floating-point arithmetic into the financial calculation layer.

---

# 5. Accounts

Create an `accounts` table.

Suggested structure:

```text
accounts
--------
id
user_id
name
account_type
currency
is_active
created_at
updated_at
```

Initial account types:

```text
checking
savings
cash
credit_card
```

Do not implement investment, mortgage, loan, or brokerage account functionality in this phase.

The schema should remain extensible enough to support them later.

---

# 6. Starting Balance

Use the ledger itself to represent an account's opening balance.

A starting balance should be represented by a special transaction type such as:

```text
STARTING_BALANCE
```

Example:

```text
Account: HDFC Savings

STARTING_BALANCE    +₹50,000
Expense              -₹2,000
Expense              -₹5,000
Income              +₹20,000
```

Then:

```text
Current account balance
=
sum of applicable ledger entries
```

This avoids maintaining a second independent balance source.

### Important

A starting balance must:

- Affect account balance.
- Not count as monthly income.
- Not count as monthly expense.
- Be associated with the correct account/user.
- Be created safely during account initialization.

---

# 7. Existing User Migration

If existing users/profiles already have transactions:

1. Create the accounts table.
2. Create a default account for each existing user.
3. Associate existing transactions with the default account.
4. Preserve all existing financial data.
5. Make the migration safe.
6. Add appropriate foreign-key constraints after the data is valid.

Do not leave existing transactions orphaned.

---

# 8. Categories

Create first-class categories.

Suggested structure:

```text
categories
----------
id
user_id
name
is_active
created_at
updated_at
```

Initial categories can include:

```text
Food
Transportation
Housing
Shopping
Entertainment
Subscriptions
Healthcare
Education
Bills
Other
```

Keep the first version simple.

Do not build a complicated nested category hierarchy unless the current product requirements actually require it.

Categories are important because all category-level financial analysis will depend on them.

---

# 9. Payees

Create a reusable `payees` table.

Suggested structure:

```text
payees
------
id
user_id
name
normalized_name
created_at
updated_at
```

Example:

```text
Amazon
Uber
Netflix
Walmart
Swiggy
Zomato
```

Transactions reference payees rather than repeatedly creating uncontrolled merchant strings.

Keep `normalized_name` available for future transaction-ingestion/merchant normalization, but do not implement automated merchant normalization now.

---

# 10. Transactions

The transaction table is the central financial ledger.

Recommended conceptual structure:

```text
transactions
------------

id
user_id

account_id
category_id
payee_id

amount
currency

transaction_type
transaction_date

description
notes

cleared_status

transfer_group_id
parent_transaction_id

created_at
updated_at
```

Potential future import fields may be added later when ingestion is actually implemented.

Do not build import behavior now just to use those fields.

---

# 11. Transaction Types

At minimum:

```text
STARTING_BALANCE
INCOME
EXPENSE
TRANSFER
```

These types must have clear semantics.

### EXPENSE

Money leaves the user's financial system for a purchase or expense.

### INCOME

Money enters the user's financial system from an external source.

### TRANSFER

Money moves between the user's own accounts.

### STARTING_BALANCE

Initial account balance used to establish the ledger.

---

# 12. Manual Expense Creation

The user must be able to manually add an expense.

Example:

```text
Amount:       ₹850
Account:      HDFC Savings
Category:     Food
Payee:        Swiggy
Date:         2026-08-10
Description:  Dinner
Notes:        Optional
```

The operation must:

1. Validate ownership of account/category/payee.
2. Validate amount.
3. Validate transaction date.
4. Create the transaction.
5. Return the created transaction.
6. Never allow another user's resources to be referenced.

---

# 13. Manual Income

The user must be able to manually record income.

Example:

```text
Amount:       ₹50,000
Account:      HDFC Savings
Category:     Income
Payee:        Salary
Date:         2026-08-01
```

Income must appear in monthly financial summaries but must not be treated as expense.

---

# 14. Transaction CRUD

The user must be able to:

### Create

```text
POST /transactions
```

### Read

```text
GET /transactions
GET /transactions/{id}
```

### Update

```text
PATCH /transactions/{id}
```

### Delete

```text
DELETE /transactions/{id}
```

Updates must validate all referenced resources again.

Deleting a transaction must not leave broken relationships.

---

# 15. Transaction Register

The frontend should provide a proper transaction history/register.

Example:

```text
DATE       PAYEE       CATEGORY       ACCOUNT       AMOUNT

Aug 10     Swiggy      Food           Savings       -₹850
Aug 09     Uber        Transport      Checking      -₹220
Aug 08     Amazon      Shopping       Credit Card   -₹1,240
Aug 01     Salary      Income         Savings       +₹50,000
```

The register should support:

- Pagination
- Date sorting
- Search
- Filtering
- Clear visual distinction between income and expenses
- Account identification
- Category identification

Do not load an unlimited transaction history into the frontend.

---

# 16. Transaction Filtering

Support:

```text
Date range
Account
Category
Payee
Transaction type
Cleared status
```

Filtering must happen efficiently at the database/query layer rather than loading the entire user's transaction history into application memory.

Add indexes based on real query patterns.

---

# 17. Cleared Status

Transactions should support a basic cleared state.

Initial states:

```text
PENDING
CLEARED
```

This is useful for the manual tracker now and provides a clean foundation for later financial synchronization.

Do not confuse cleared status with future concepts such as:

```text
AI categorized
user reviewed
imported
```

Those are different concepts and should be modeled separately if/when future ingestion is built.

---

# 18. Transfers

Transfers must not count as income or expense.

Example:

```text
HDFC Savings → HDFC Checking
₹10,000
```

Represent the transfer as two linked ledger entries:

```text
Savings
-₹10,000
TRANSFER
transfer_group_id = XYZ

Checking
+₹10,000
TRANSFER
transfer_group_id = XYZ
```

Use:

```text
transfer_group_id
```

as the common relationship.

Do not depend on destructive database-level cascading as the main transfer-management mechanism.

Instead, the transfer service should create/update/delete both sides atomically.

Conceptually:

```text
create_transfer()
    ↓
BEGIN TRANSACTION
    ↓
create debit
create credit
    ↓
COMMIT
```

If one side fails, the entire operation should roll back.

---

# 19. Split Transactions

Split transactions are a useful ledger capability and should be implemented only if the current manual UX can support them cleanly.

Example:

```text
Target
₹1,000
```

can be split into:

```text
Groceries       ₹600
Electronics     ₹400
```

Model:

```text
Parent transaction
        │
        ├── Child: Groceries ₹600
        └── Child: Electronics ₹400
```

Use:

```text
parent_transaction_id
```

for the relationship.

## Critical invariant

If a transaction has children:

> The parent is a container/summary record and must not be counted as an additional expense.

Therefore:

```text
Parent = ₹1,000
Child A = ₹600
Child B = ₹400
```

must produce:

```text
Total expense = ₹1,000
```

NOT:

```text
₹2,000
```

### Reporting rule

For category-level spending:

- Standalone transactions are counted.
- Child split transactions are counted.
- Parent split transactions are excluded.

For total spending:

- Use a consistent ledger query that counts the economic transaction exactly once.

Do not allow different analytics endpoints to use contradictory split rules.

---

# 20. Monthly Financial Structure

The system must support financial periods by calendar month.

Example:

```text
January 2026
February 2026
March 2026
...
August 2026
```

Do not create a `monthly_expenses` table solely to store calculated totals.

Monthly values should be derived from transactions.

Example:

```text
August 2026

Income:     ₹50,000
Expenses:   ₹28,500
Transfers:  ₹10,000
```

Transfers should not inflate income or expenses.

Starting balances should not inflate monthly income or expenses.

---

# 21. Category-Wise Spending

For a selected month:

```text
August 2026

Food              ₹4,500
Transportation    ₹2,100
Shopping          ₹6,800
Entertainment     ₹1,200
Subscriptions       ₹900
Bills            ₹10,000
```

Category spending must be calculated from transaction history.

Rules:

```text
transaction_type = EXPENSE
```

and:

- Include standalone categorized expenses.
- Include categorized child split transactions.
- Exclude transfer transactions.
- Exclude income.
- Exclude starting balances.
- Exclude split parent container records.

---

# 22. Month-over-Month Comparison

The system must compare financial periods.

Example:

```text
Category          July       August       Change

Food              ₹3,800      ₹4,500      +18.4%
Transport         ₹2,400      ₹2,100      -12.5%
Shopping          ₹4,200      ₹6,800      +61.9%
Entertainment     ₹1,000      ₹1,200      +20.0%
```

Also provide total comparison:

```text
July expenses:     ₹24,500
August expenses:   ₹28,500

Change:            +₹4,000
Percentage:        +16.3%
```

Calculations must be deterministic.

The LLM must never be responsible for calculating these numbers.

---

# 23. Basic Budgeting

After the transaction ledger is stable, implement monthly category budgets.

Create:

```text
budget_entries
--------------
id
user_id
category_id
month
budgeted_amount
created_at
updated_at
```

Example:

```text
Food
August 2026

Budgeted:  ₹5,000
Spent:     ₹4,500
Remaining: ₹500
```

Important:

Do not store:

```text
spent
remaining
```

as independent financial state.

Calculate them from:

```text
budget_entries
+
transactions
```

This prevents stale budget values.

---

# 24. Goals

Implement only the minimum goal linkage required by the current BuyWise design.

Goals may contain:

```text
category_id
goal_type
```

Goal progress should eventually be derived from real financial activity.

Do not build advanced forecasting in this phase.

The important architectural requirement is:

```text
Goal
  ↓
Category
  ↓
Transactions / Budget
  ↓
Real progress
```

rather than a manually maintained progress number.

---

# 25. Backend Architecture

Maintain a clean backend structure:

```text
Route
  ↓
Service
  ↓
Repository
  ↓
Database
```

### Route

Responsible for:

- HTTP request/response
- Authentication dependency
- Input validation
- Calling services

### Service

Responsible for:

- Business rules
- Transaction semantics
- Transfer creation
- Split validation
- Budget calculations
- Ownership validation
- Financial invariants

### Repository

Responsible for:

- Database queries
- Persistence
- Efficient filtering
- Aggregation queries

Do not place financial business logic directly inside route handlers.

---

# 26. API Surface

## Accounts

```text
POST   /accounts
GET    /accounts
GET    /accounts/{id}
PATCH  /accounts/{id}
DELETE /accounts/{id}
```

## Categories

```text
POST   /categories
GET    /categories
GET    /categories/{id}
PATCH  /categories/{id}
DELETE /categories/{id}
```

## Payees

```text
POST   /payees
GET    /payees
GET    /payees/{id}
PATCH  /payees/{id}
DELETE /payees/{id}
```

## Transactions

```text
POST   /transactions
GET    /transactions
GET    /transactions/{id}
PATCH  /transactions/{id}
DELETE /transactions/{id}
```

## Transfers

```text
POST   /transfers
```

## Budgets

```text
POST   /budgets
GET    /budgets/{month}
PATCH  /budgets/{id}
DELETE /budgets/{id}
```

## Analytics

```text
GET /analytics/monthly
GET /analytics/categories
GET /analytics/comparison
```

Use the existing goals API and extend it only where required.

---

# 27. Database Integrity

The ledger must enforce:

- Foreign keys
- User ownership
- Valid account relationships
- Valid category relationships
- Valid payee relationships
- Valid transfer relationships
- Valid parent/child transaction relationships
- Valid monetary amounts
- Appropriate uniqueness constraints
- Appropriate indexes

Every financial record must be scoped to the correct user.

Never trust a client-provided user ID as authorization.

Derive ownership from the authenticated user.

---

# 28. Financial Invariants

The following must always hold.

## Transfer invariant

A completed transfer has exactly two corresponding sides:

```text
debit + credit = 0
```

within the transfer group.

## Split invariant

For a split transaction:

```text
sum(children)
=
parent amount
```

with exact integer arithmetic.

## Ownership invariant

Every financial record belongs to exactly one user.

## Account invariant

Every transaction belongs to a valid account owned by the same user.

## Category invariant

Every categorized expense references a valid category owned by the same user.

## No double counting

A split parent must never be counted together with its children.

## Financial calculation invariant

Monthly/category/budget calculations must be reproducible from the underlying ledger.

---

# 29. Testing Requirements

Testing is part of the implementation, not a final cleanup step.

## Transaction tests

Test:

- Create expense
- Create income
- Update transaction
- Delete transaction
- Invalid account
- Invalid category
- Invalid payee
- Invalid amount
- Unauthorized transaction access

## Transfer tests

Test:

- Transfer creates both sides
- Correct debit/credit signs
- Same transfer group
- Transfer excluded from expense totals
- Transfer excluded from income totals
- Atomic rollback when one side fails
- Deleting a transfer removes both sides through the service layer

## Split tests

Test:

```text
Parent = ₹1,000
Child A = ₹600
Child B = ₹400
```

must equal exactly:

```text
₹1,000
```

Test that:

- Parent is excluded from category totals.
- Children are included.
- Children cannot exceed parent amount.
- Child totals must equal parent amount.

## Monthly analytics tests

Test:

- Current month
- Previous month
- Month boundaries
- Empty months
- Multiple accounts
- Income
- Expenses
- Transfers
- Starting balances
- Split transactions

## Budget tests

Test:

- Budget creation
- Budget update
- Budget retrieval
- Correct spent amount
- Correct remaining amount
- Overspending
- Empty category

## Data isolation tests

Test that:

```text
User A cannot:
    read User B's accounts
    read User B's transactions
    modify User B's transactions
    delete User B's categories
    modify User B's budgets
```

Test both normal API usage and manipulated resource IDs.

---

# 30. Performance Requirements

The system should be designed for growth without premature optimization.

At minimum:

- Paginate transaction lists.
- Index `user_id`.
- Index account relationships.
- Index transaction dates.
- Index category relationships.
- Index payee relationships where useful.
- Use database-side aggregation for monthly/category reports.
- Avoid loading full transaction history into application memory.

Do not create redundant summary tables unless actual scale later demonstrates that they are necessary.

---

# 31. Future Compatibility Without Future Implementation

The schema should be **extensible**, but this phase should not implement future ingestion features.

Future systems may eventually introduce:

```text
CSV imports
XLSX imports
PDF statements
Bank APIs
Receipt parsing
AI categorization
Transaction normalization
Duplicate detection
Import review
```

When those features are actually started, revisit the transaction schema and add the appropriate concepts, potentially including:

```text
source
external_id
import_batch_id
original_description
review_status
```

Do not add a collection of speculative fields merely because they might be useful someday.

The goal is:

> **Avoid architectural dead ends, not predict every future column.**

---

# 32. Definition of Done

The current manual expense tracker is complete when a test user can:

```text
1. Create an account
2. Create categories
3. Create payees
4. Add an expense
5. Add income
6. Edit a transaction
7. Delete a transaction
8. Create a transfer
9. View transaction history
10. Filter transactions
11. View current-month spending
12. View previous-month spending
13. Compare months
14. View category-wise spending
15. Set monthly category budgets
16. See budget vs actual
17. Link a goal to a category
18. See basic goal progress
```

And:

```text
All financial calculations are deterministic.
All financial records are user-isolated.
Transfers do not become expenses.
Splits do not double-count.
Starting balances do not become income.
Money calculations do not use floating point.
```

---


---

# 33. Existing BuyWise Database and Codebase Migration

The current repository already contains an older expense/transaction implementation and existing database tables.

**Do not build the new system beside the old system without first auditing what already exists.**

Before implementation:

1. Inspect the existing database schema.
2. Inspect the existing expense-related models.
3. Inspect existing migrations.
4. Inspect existing repositories/services/routes.
5. Inspect the current AI service and its financial tools.
6. Identify which old tables, columns, services, and endpoints are obsolete.
7. Identify which existing pieces can safely be reused.
8. Decide whether each old component should be migrated, replaced, or removed.

## Database cleanup

The final system must not leave conflicting legacy expense structures behind.

If old expense tables/models are no longer compatible with the new ledger:

- Create the required migration.
- Preserve any data that must be retained.
- Migrate useful existing data into the new schema where appropriate.
- Remove obsolete tables/columns after migration and verification.
- Remove obsolete ORM models and repository/service code.
- Remove dead endpoints that expose the old model.
- Ensure the database has one clear source of truth for financial transactions.

Do **not** blindly drop existing tables before determining whether existing data needs to be migrated.

If this is a development database and the old financial data is disposable, a clean rebuild may be appropriate, but this must be an explicit implementation decision rather than an accidental data loss event.

## No parallel financial systems

After this phase there should not be two competing expense systems such as:

```text
old expenses table
        +
new transactions table
```

with different sources of truth.

The new ledger must become the canonical financial system.

---

# 34. Preserve Compatibility With the Existing AI Service

This is a critical requirement.

The existing BuyWise AI service and its financial tools must remain usable after the financial-system migration.

The manual expense tracker is being rebuilt **underneath the existing AI layer**, not as an unrelated replacement.

Before changing financial models:

1. Inspect every existing AI financial tool.
2. Identify what database models/endpoints/services each tool currently depends on.
3. Document the expected input/output contract of each tool.
4. Map each tool's current data requirements to the new ledger.
5. Update the tools to use the new financial services/analytics layer.
6. Preserve tool names and response contracts where practical unless there is a strong reason to change them.
7. Add tests proving that the tools return correct results from the new ledger.

The intended architecture is:

```text
                BUYWISE DATABASE
                       │
                       ▼
                New Financial Ledger
                       │
                       ▼
             Financial Service Layer
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       CRUD/API Layer       AI Financial Tools
                                   │
                                   ▼
                              AI SERVICE
```

The AI should not need to know whether the underlying transaction was created through a manual CRUD request, as long as the financial service provides the correct normalized data.

## AI tool compatibility requirement

At the end of this implementation phase:

- Existing AI tools must still be able to access financial information.
- Tools must read from the new ledger.
- Monthly/category calculations must use the same deterministic financial logic as the dashboard.
- The AI must not depend on legacy expense tables.
- No AI tool should silently return data from the old and new systems simultaneously.
- Existing AI functionality should be regression-tested after the migration.

For example, if an existing tool provides:

```text
get_monthly_spending()
get_category_spending()
get_budget_status()
get_goal_progress()
```

those tools should ultimately call the new financial service/analytics layer rather than querying legacy tables directly.

---

# 35. Migration Completion Criteria

The migration is not complete merely because the new tables exist.

It is complete only when:

```text
Old financial model
        ↓
Migrated / removed
        ↓
New ledger is canonical
        ↓
CRUD works
        ↓
Analytics work
        ↓
Existing AI tools work against new ledger
```

Before marking the task complete, verify:

### Database

- No obsolete expense table is being used.
- No conflicting source of truth remains.
- Existing required data has been preserved or intentionally discarded.
- Foreign keys and indexes are correct.
- Migrations work from the current repository state.

### Backend

- Old expense models are removed or intentionally deprecated.
- New services/repositories are the canonical implementation.
- Old routes are removed or migrated.
- No service accidentally queries the legacy tables.

### AI

- Existing financial tools work.
- Existing tool contracts remain compatible where possible.
- Tool results match the new dashboard calculations.
- AI tools use the new financial service layer.
- No legacy financial data path remains.

### Regression

Run:

```text
existing backend tests
new financial ledger tests
analytics tests
AI tool tests
integration tests
```

The migration must leave BuyWise in a state where:

> **The new manual financial tracker is the only source of truth, while the existing AI service can immediately build on top of it.**

---

# 36. Final Engineering Boundary

Do not expand this task because future BuyWise features are exciting.

The current task is:

> **Build the reliable manual financial ledger that BuyWise can trust.**

The next phases can build on it:

```text
CURRENT
Manual Financial Tracker
        │
        ▼
Reliable Financial Data
        │
        ▼
FUTURE
Historical Data Ingestion
        │
        ▼
Financial Analytics / Tools
        │
        ▼
AI Service
        │
        ▼
BuyWise AI Financial Advisor
```

The future AI advisor is the product.

The current expense tracker is the foundation.

Build the foundation correctly, keep it narrow, and stop when the definition of done is satisfied.
