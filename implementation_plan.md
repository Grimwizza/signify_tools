# Finance Roles — Implementation Plan

## Summary

Add two Finance sub-roles to the Signify Prompt Builder with 2 new category tabs and 18 new prompt templates. All changes are contained in `signify-prompt-builder.html`.

---

## New Roles

| Key | Label | Context String |
|---|---|---|
| `fp_a` | FP&A / Business Finance | FP&A / Business Finance Manager at Signify North America |
| `accounting` | Accounting / Controller | Accounting Manager / Controller at Signify North America |

---

## New Categories

| Key | Label |
|---|---|
| `finance` | Finance & Reporting |
| `excel` | Excel & Data |

---

## New Templates

### Finance & Reporting (`finance` cat)

| Key | Title | Visible To |
|---|---|---|
| `variance_analysis` | Variance Analysis | `fp_a` only |
| `forecast_update` | Forecast Update | `fp_a` only |
| `business_case` | Business Case | `fp_a` only |
| `channel_pl` | Channel P&L Review | `fp_a` only |
| `financial_brief` | Financial Brief | both |
| `month_end_close` | Month-End Close | `accounting` only |
| `account_recon` | Account Reconciliation | `accounting` only |
| `journal_entry` | Journal Entry Doc | `accounting` only |
| `audit_prep` | Audit Prep | `accounting` only |
| `period_close_email` | Close Communication | `accounting` only |

### Excel & Data (`excel` cat)

| Key | Title | Visible To |
|---|---|---|
| `formula_builder` | Formula Builder | both |
| `lookup_helper` | XLOOKUP / Index-Match | both |
| `conditional_logic` | Conditional Logic | both |
| `data_cleanup` | Data Cleanup | both |
| `pivot_design` | Pivot Table Design | both |
| `power_query` | Power Query | both |
| `power_bi_dax` | Power BI / DAX | both |
| `sap_extract` | SAP Data Helper | both |

---

## Data Structure Changes

### 1. Role Select Dropdown (HTML)
Add 2 new `<option>` elements.

### 2. `CATS` object
Add `finance` and `excel` keys with their template arrays.

### 3. `ROLES` object
Add `fp_a` and `accounting` entries.

### 4. `ROLE_CAT_ORDER`
```
fp_a:       ['finance', 'excel', 'daily', 'sales', 'planning', 'marketing']
accounting: ['finance', 'daily', 'excel', 'planning', 'sales', 'marketing']
```

### 5. `ROLE_HIDDEN_TEMPLATES`
```
fp_a:       battle_card, objection_handling, buyer_email, content_brief,
            product_positioning, product_coach,
            month_end_close, account_recon, journal_entry, audit_prep, period_close_email

accounting: battle_card, objection_handling, buyer_email, content_brief,
            product_positioning, channel_strategy, product_coach,
            variance_analysis, forecast_update, business_case, channel_pl
```

### 6. `ROLE_PREFILLS`
- `fp_a`: variance_analysis, forecast_update, exec_summary, weekly_update, market_research
- `accounting`: month_end_close, exec_summary, weekly_update

### 7. `ROLE_PROMPT_CONTEXT`
Add `fp_a` / `accounting` entries to: `exec_summary`, `deck_builder`, `research_report`, `weekly_update`, `market_research`

### 8. `T` (templates object)
Add all 18 new template definitions.

---

## Execution Order

1. Add role options to HTML dropdown
2. Add `finance` + `excel` to `CATS`
3. Add `fp_a` + `accounting` to `ROLES`, `ROLE_CAT_ORDER`, `ROLE_HIDDEN_TEMPLATES`, `ROLE_PREFILLS`
4. Extend `ROLE_PROMPT_CONTEXT` for shared templates
5. Add Finance & Reporting templates to `T`
6. Add Excel & Data templates to `T`
7. Update `README.md`
