# Signify Prompt Builder

A single-page internal tool for **Signify North America** team members to generate tailored, copy-paste-ready Microsoft Copilot prompts — no prompt-writing experience needed.

**Deployed:** GitHub Pages
**File:** `signify-prompt-builder.html` (all HTML/CSS/JS in one file, no build step)
**Entry:** `index.html` is a basic placeholder; the tool lives at `/signify-prompt-builder.html`

---

## How It Works

1. Select your **role** (persisted in `localStorage`)
2. Choose a **Copilot mode** (Chat = free / M365 = paid)
3. Pick a **category tab**, then a **template**
4. Fill in the **form fields**
5. Click **Generate Prompt** → copy and paste into Copilot

The generated prompt automatically prepends:
- `MY ROLE:` — full role context string
- `ROLE FOCUS:` — role-specific framing for that template (where applicable)

---

## Roles

| Key | Label |
|---|---|
| `kam` | Key Account Manager / Sales Analyst |
| `channel` | Channel / Product Marketing Manager |
| `marcom` | Marcom / Brand Marketing Manager |
| `leadership` | Sales Director / VP |
| `fp_a` | FP&A / Business Finance Manager |
| `accounting` | Accounting Manager / Controller |

Each role affects:
- **Category tab order** (`ROLE_CAT_ORDER`)
- **Hidden templates** (`ROLE_HIDDEN_TEMPLATES`)
- **Pre-filled field values** (`ROLE_PREFILLS`)
- **Role-specific prompt framing** (`ROLE_PROMPT_CONTEXT`)

### Category Tab Order by Role

| Role | Tab Order |
|---|---|
| `kam` | Sales, Daily, Marketing, Planning |
| `channel` | Marketing, Sales, Planning, Daily |
| `marcom` | Marketing, Planning, Daily, Sales |
| `leadership` | Daily, Planning, Sales, Marketing |
| `fp_a` | Finance, Excel, Daily, Sales, Planning, Marketing |
| `accounting` | Finance, Daily, Excel, Planning, Sales, Marketing |

---

## Copilot Modes

| Mode | Badge | Behavior |
|---|---|---|
| `chat` | FREE | Generic prompts; user pastes content manually into Copilot |
| `m365` | PAID | Prompts reference Outlook, Teams, Calendar directly |

M365-only templates are hidden when in Chat mode.

---

## Templates

### Sales Enablement (`sales`)
| Key | Title | Hidden For |
|---|---|---|
| `competitive_intel` | Competitive Intel | — |
| `battle_card` | Battle Card | `channel`, `marcom`, `leadership`, `fp_a`, `accounting` |
| `objection_handling` | Objection Handling | `channel`, `marcom`, `leadership`, `fp_a`, `accounting` |
| `buyer_email` | Buyer Email | `marcom`, `fp_a`, `accounting` |

### Marketing (`marketing`)
| Key | Title | Hidden For |
|---|---|---|
| `market_research` | Market Research | — |
| `product_positioning` | Product Positioning | `fp_a`, `accounting` |
| `channel_strategy` | Channel Strategy | `accounting` |
| `content_brief` | Content Brief | `kam`, `fp_a`, `accounting` |

### Daily Tasks (`daily`)
| Key | Title | M365 Only | Hidden For |
|---|---|---|---|
| `meeting_recap` | Meeting Recap | ✅ | — |
| `email_search` | Email Search | ✅ | — |
| `exec_summary` | Exec Summary | — | — |
| `weekly_update` | Weekly Update | — | — |

### Presentations & Planning (`planning`)
| Key | Title | M365 Only | Hidden For |
|---|---|---|---|
| `deck_builder` | Deck Builder | — | — |
| `agenda_builder` | Agenda Builder | ✅ | — |
| `product_coach` | Product Coach | — | `fp_a`, `accounting` |
| `research_report` | Research & Reporting | — | — |

### Finance & Reporting (`finance`)
| Key | Title | Visible To |
|---|---|---|
| `variance_analysis` | Variance Analysis | `fp_a` only |
| `forecast_update` | Forecast Update | `fp_a` only |
| `business_case` | Business Case | `fp_a` only |
| `channel_pl` | Channel P&L Review | `fp_a` only |
| `financial_brief` | Financial Brief | `fp_a`, `accounting` |
| `month_end_close` | Month-End Close | `accounting` only |
| `account_recon` | Account Reconciliation | `accounting` only |
| `journal_entry` | Journal Entry Doc | `accounting` only |
| `audit_prep` | Audit Prep | `accounting` only |
| `period_close_email` | Close Communication | `accounting` only |

### Excel & Data (`excel`)
| Key | Title | Visible To |
|---|---|---|
| `formula_builder` | Formula Builder | `fp_a`, `accounting` |
| `lookup_helper` | XLOOKUP / Index-Match | `fp_a`, `accounting` |
| `conditional_logic` | Conditional Logic | `fp_a`, `accounting` |
| `data_cleanup` | Data Cleanup | `fp_a`, `accounting` |
| `pivot_design` | Pivot Table Design | `fp_a`, `accounting` |
| `power_query` | Power Query | `fp_a`, `accounting` |
| `power_bi_dax` | Power BI / DAX | `fp_a`, `accounting` |
| `sap_extract` | SAP Data Helper | `fp_a`, `accounting` |

---

## Field Types

| Type | Behavior |
|---|---|
| `chips` | Single or multi-select pill buttons |
| `select` | Dropdown (`optsByRole` support for role-specific options) |
| `text` | Single-line input |
| `textarea` | Multi-line input |

Fields can be marked `required: true` — triggers a soft validation warning (not a blocker).

Fields with `custom: true` (competitor chips) allow adding custom entries via a text input.

---

## Key Data Constants

| Constant | Purpose |
|---|---|
| `COMPETITORS` | Default competitor list (14 brands); user-extendable |
| `CHANNELS` | Retail channels (Amazon, Best Buy, Home Depot, etc.) |
| `CATEGORIES` | Product categories (Smart Bulbs, LED Fixtures, etc.) |
| `AUDIENCES` | Target audience types (DIY Homeowner, Retail Buyer, etc.) |

---

## Signify Brand Portfolio

| Brand | Tier |
|---|---|
| Philips Hue | Premium smart lighting |
| WiZ | Value smart lighting |
| Philips LED | Non-connected LED |

---

## JavaScript Architecture

All logic is inline in a single `<script>` block:

| Function | Purpose |
|---|---|
| `setRole(r)` | Switch role, reset state, re-render everything |
| `setCopilot(type)` | Toggle chat/M365 mode |
| `renderCatBar()` | Render category tabs in role order |
| `renderTmplBar()` | Render template pills, respecting mode + role filters |
| `renderBuilder()` | Render form fields for current template, apply prefills |
| `switchCat(c)` | Change category, reset template + form |
| `switchTmpl(t)` | Change template, reset form |
| `selChip(el,fid,v,multi)` | Handle chip selection (single or multi) |
| `addComp(fid,multi)` | Add a custom competitor chip |
| `uf(id,v)` | Update `formData` object on any input change |
| `gen()` | Generate the prompt, prepend role context, render output |
| `copyPrompt()` | Copy output to clipboard (with `execCommand` fallback) |
| `fv(v,fallback)` | Format a value — handles arrays (joins with `, `) |

State variables: `copilotType`, `userRole`, `currentCat`, `currentTemplate`, `formData`, `customCompetitors`
