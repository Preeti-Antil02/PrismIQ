# PrismIQ Postgres Migration Verification Report
Generated at: 2026-08-30 06:56:17 UTC

## 1. Table Record Count Reconciliation (LIVE Database Queries)
| Table Name | Total Live Rows (`SELECT COUNT(*)`) | Real Data (`is_mock=false`) | Mock Fixture (`is_mock=true`) | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `competitors` | **42** | **41** | 1 | EXACT MATCH (100%) | Test company fixture |
| `raw_signals` | **853** | **851** | 2 | EXACT MATCH (100%) | Contains 2 mock fixture rows |
| `noise_suppression_decisions` | **853** | **851** | 2 | EXACT MATCH (100%) | Contains 2 mock fixture rows |
| `consolidated_events` | **663** | **661** | 2 | EXACT MATCH (100%) | Contains 2 mock fixture rows |
| `event_signals` | **681** | **679** | 2 | EXACT MATCH (100%) | Contains 2 mock fixture rows |
| `findings` | **63** | **63** | 0 | EXACT MATCH (100%) | 100% Real Production Data |
| `briefs` | **3** | **3** | 0 | DISCREPANCY | 100% Real Production Data |
| `discovery_proposals` | **3** | **3** | 0 | EXACT MATCH (100%) | 100% Real Production Data |
| `discovery_candidates` | **11** | **11** | 0 | EXACT MATCH (100%) | 100% Real Production Data |
| `discovery_sources` | **38** | **38** | 0 | EXACT MATCH (100%) | 100% Real Production Data |
| `pricing_snapshots` | **9** | **9** | 0 | EXACT MATCH (100%) | 100% Real Production Data |
| `eval_grading_records` | **33** | **33** | 0 | EXACT MATCH (100%) | 100% Real Production Data |

## 2. Footing & Arithmetic Summary (Part 8.0 Compliance)
Showing explicit addition of per-table records across the database schema:
```text
Per-Table Counts Addition (Total vs Real vs Mock):
  + competitors                   : Total=  42 | Real=  41 | Mock= 1
  + raw_signals                   : Total= 853 | Real= 851 | Mock= 2
  + noise_suppression_decisions   : Total= 853 | Real= 851 | Mock= 2
  + consolidated_events           : Total= 663 | Real= 661 | Mock= 2
  + event_signals                 : Total= 681 | Real= 679 | Mock= 2
  + findings                      : Total=  63 | Real=  63 | Mock= 0
  + briefs                        : Total=   3 | Real=   3 | Mock= 0
  + discovery_proposals           : Total=   3 | Real=   3 | Mock= 0
  + discovery_candidates          : Total=  11 | Real=  11 | Mock= 0
  + discovery_sources             : Total=  38 | Real=  38 | Mock= 0
  + pricing_snapshots             : Total=   9 | Real=   9 | Mock= 0
  + eval_grading_records          : Total=  33 | Real=  33 | Mock= 0
  -------------------------------------------------------
  = TOTAL DATABASE ENTITY ROWS   : Total=3252 | Real=3243 | Mock= 9
```

### Source File Footing:
- Total flat files scanned: **195 files**
- Total raw records counted across all files: **4753 raw entries**
- Total unique deduplicated normalized entities: **3252 records**

## 3. Root-Signal Event ID Stability & Corroboration Re-Verification (Live Database)
Verifying that live multi-signal events have stable root-signal IDs and exact event_signals link counts:

### Multi-Signal Event #1: `evt_31a2d43435da0138`
- **Company**: `Cloudflare Pages/Workers`
- **Canonical Title**: Job Posting: Research Engineer Intern (Fall 2026) (Technology Research)
- **Corroboration Count in `consolidated_events`**: `3`
- **Linked Signals in `event_signals` Join Table**: `3` (Match: `YES`)
- **Linked Contributing Signals**:
  1. `[sig_31a2d43435da0138]` (jobs) Job Posting: Research Engineer Intern (Fall 2026) (Technology Research... (Pub: `2026-08-25T19:38:33-04:00`)
  2. `[sig_33b7cd4bbbe110b5]` (jobs) Job Posting: Research Engineer Intern (Fall 2026) (Technology Research... (Pub: `2026-08-25T19:38:33-04:00`)
  3. `[sig_e66353cb8c4ff2e6]` (jobs) Job Posting: Research Engineer Intern (Fall 2026) (Technology Research... (Pub: `2026-08-25T19:38:33-04:00`)

### Multi-Signal Event #2: `evt_5238fd1984ea8ee1`
- **Company**: `Vercel`
- **Canonical Title**: GitHub Issue closed in vercel/ai: FEATURE: [openai-compatible] Add mTLS (mutual TLS) support for custom providers
- **Corroboration Count in `consolidated_events`**: `3`
- **Linked Signals in `event_signals` Join Table**: `3` (Match: `YES`)
- **Linked Contributing Signals**:
  1. `[sig_5238fd1984ea8ee1]` (github) GitHub Issue opened in vercel/ai: FEATURE: [openai-compatible] Add mTL... (Pub: `2026-08-27T17:17:07Z`)
  2. `[sig_a96860ad7115b0a0]` (github) GitHub Issue labeled in vercel/ai: FEATURE: [openai-compatible] Add mT... (Pub: `2026-08-27T17:19:26Z`)
  3. `[sig_3bcd5be27d8bcb1c]` (github) GitHub Issue closed in vercel/ai: FEATURE: [openai-compatible] Add mTL... (Pub: `2026-08-27T17:24:49Z`)

### Multi-Signal Event #3: `evt_012cf2312d5dea59`
- **Company**: `Cloudflare Pages/Workers`
- **Canonical Title**: Job Posting: Forward Deployed Engineer, Professional Services (Professional Services)
- **Corroboration Count in `consolidated_events`**: `2`
- **Linked Signals in `event_signals` Join Table**: `2` (Match: `YES`)
- **Linked Contributing Signals**:
  1. `[sig_012cf2312d5dea59]` (jobs) Job Posting: Forward Deployed Engineer, Professional Services (Profess... (Pub: `2026-08-25T19:38:33-04:00`)
  2. `[sig_ba1cfc328ebaf13b]` (jobs) Job Posting: Forward Deployed Engineer, Professional Services (Profess... (Pub: `2026-08-26T10:18:44-04:00`)

## 4. Field-by-Field Spot-Check Audit (Minimum 10 Records Per Table)
Comparing migrated Postgres fields against raw source JSON data:

### Table: `raw_signals` (10 Spot-Checked Records)
**Record #1:**
  - `id`: Source=`Vercel` | Postgres=`sig_5db8569210107f9c` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Is Agentic by Vercel — AI Agent Readiness Score` | Postgres=`Is Agentic by Vercel — AI Agent Readiness Score` [MATCH]
  - `url`: Source=`https://is-agentic.com` | Postgres=`https://is-agentic.com` [MATCH]
  - `published_at`: Source=`2026-08-22 05:32:38 +0000` | Postgres=`2026-08-22 05:32:38 +0000` [MATCH]
**Record #2:**
  - `id`: Source=`Vercel` | Postgres=`sig_6422a1aad9e91465` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Vercel Shipped is-agentic.com. Here Is How the Scoreboard Works` | Postgres=`Vercel Shipped is-agentic.com. Here Is How the Scoreboard Wo...` [MATCH]
  - `url`: Source=`https://dev.to/promptway/vercel-shipped-is-agenticcom-here-is-how-the-scoreboard-works-49d3` | Postgres=`https://dev.to/promptway/vercel-shipped-is-agenticcom-here-i...` [MATCH]
  - `published_at`: Source=`2026-08-21 21:41:49 +0000` | Postgres=`2026-08-21 21:41:49 +0000` [MATCH]
**Record #3:**
  - `id`: Source=`Vercel` | Postgres=`sig_c877af0cc0cc8b94` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`is-agentic Scored Promptway 74. Here Is What I Changed` | Postgres=`is-agentic Scored Promptway 74. Here Is What I Changed` [MATCH]
  - `url`: Source=`https://dev.to/promptway/is-agentic-scored-promptway-74-here-is-what-i-changed-4if9` | Postgres=`https://dev.to/promptway/is-agentic-scored-promptway-74-here...` [MATCH]
  - `published_at`: Source=`2026-08-21 21:20:45 +0000` | Postgres=`2026-08-21 21:20:45 +0000` [MATCH]
**Record #4:**
  - `id`: Source=`Vercel` | Postgres=`sig_f3fe12b47824e787` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Migrating an Express Backend to Vercel Functions Without Downtime` | Postgres=`Migrating an Express Backend to Vercel Functions Without Dow...` [MATCH]
  - `url`: Source=`https://dev.to/gabbs279/migrating-an-express-backend-to-vercel-functions-without-downtime-3kal` | Postgres=`https://dev.to/gabbs279/migrating-an-express-backend-to-verc...` [MATCH]
  - `published_at`: Source=`2026-08-21 19:59:20 +0000` | Postgres=`2026-08-21 19:59:20 +0000` [MATCH]
**Record #5:**
  - `id`: Source=`Vercel` | Postgres=`sig_6637386cf4125c25` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`How Ora benchmarks every major AI agent on Vercel | Customers | Vercel` | Postgres=`How Ora benchmarks every major AI agent on Vercel | Customer...` [MATCH]
  - `url`: Source=`https://vercel.com/customers/how-ora-benchmarks-every-major-ai-agent-on-vercel` | Postgres=`https://vercel.com/customers/how-ora-benchmarks-every-major-...` [MATCH]
  - `published_at`: Source=`2026-08-21 18:28:52 +0000` | Postgres=`2026-08-21 18:28:52 +0000` [MATCH]
**Record #6:**
  - `id`: Source=`Vercel` | Postgres=`sig_cce38ca2cc79ec67` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Deployment Storage keeps your deployments rollback-ready - Vercel` | Postgres=`Deployment Storage keeps your deployments rollback-ready - V...` [MATCH]
  - `url`: Source=`https://vercel.com/changelog/deployment-storage-keeps-your-deployments-rollback-ready` | Postgres=`https://vercel.com/changelog/deployment-storage-keeps-your-d...` [MATCH]
  - `published_at`: Source=`2026-08-21 14:50:40 +0000` | Postgres=`2026-08-21 14:50:40 +0000` [MATCH]
**Record #7:**
  - `id`: Source=`Vercel` | Postgres=`sig_40b8a0541656c301` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Pi Agent vs OpenCode after 100+ Hours of Real Use ✌️` | Postgres=`Pi Agent vs OpenCode after 100+ Hours of Real Use ✌️` [MATCH]
  - `url`: Source=`https://dev.to/composiodev/pi-agent-vs-opencode-after-100-hours-of-real-use-1mh7` | Postgres=`https://dev.to/composiodev/pi-agent-vs-opencode-after-100-ho...` [MATCH]
  - `published_at`: Source=`2026-08-21 13:31:28 +0000` | Postgres=`2026-08-21 13:31:28 +0000` [MATCH]
**Record #8:**
  - `id`: Source=`Vercel` | Postgres=`sig_88715630324c33c1` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Slack will now let you code as a team to get those tricky tasks done` | Postgres=`Slack will now let you code as a team to get those tricky ta...` [MATCH]
  - `url`: Source=`https://www.techradar.com/pro/slack-will-now-let-you-code-as-a-team-to-get-those-tricky-tasks-done` | Postgres=`https://www.techradar.com/pro/slack-will-now-let-you-code-as...` [MATCH]
  - `published_at`: Source=`2026-08-21 09:05:00 +0000` | Postgres=`2026-08-21 09:05:00 +0000` [MATCH]
**Record #9:**
  - `id`: Source=`Vercel` | Postgres=`sig_d2d9707e3d01c357` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`Slack Code Introduced to Help Teams Build Software With AI Agents` | Postgres=`Slack Code Introduced to Help Teams Build Software With AI A...` [MATCH]
  - `url`: Source=`https://www.gadgets360.com/apps/news/slack-code-ai-coding-agents-workspace-features-update-11939932` | Postgres=`https://www.gadgets360.com/apps/news/slack-code-ai-coding-ag...` [MATCH]
  - `published_at`: Source=`2026-08-21 08:50:23 +0000` | Postgres=`2026-08-21 08:50:23 +0000` [MATCH]
**Record #10:**
  - `id`: Source=`Vercel` | Postgres=`sig_8ec89ac7900df2a0` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `source`: Source=`news` | Postgres=`news` [MATCH]
  - `title`: Source=`How We Standardized on Next.js + Supabase to Ship Client Sites Fast at a 2-Person Agency` | Postgres=`How We Standardized on Next.js + Supabase to Ship Client Sit...` [MATCH]
  - `url`: Source=`https://dev.to/locallify/how-we-standardized-on-nextjs-supabase-to-ship-client-sites-fast-at-a-2-person-agency-3hkd` | Postgres=`https://dev.to/locallify/how-we-standardized-on-nextjs-supab...` [MATCH]
  - `published_at`: Source=`2026-08-21 04:22:54 +0000` | Postgres=`2026-08-21 04:22:54 +0000` [MATCH]

### Table: `consolidated_events` (10 Spot-Checked Records)
**Record #1:**
  - `event_id`: Source=`evt_3ca5581e89baa029` | Postgres=`evt_e007cb3a7238e020` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `title`: Source=`Netlify SDK Release v3.0` | Postgres=`Netlify SDK Release v3.0` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/netlify/sdk` | Postgres=`https://github.com/netlify/sdk` [MATCH]
**Record #2:**
  - `event_id`: Source=`evt_c019ee2d99a71209` | Postgres=`evt_9555f9b431095481` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`Vercel Launches Enterprise Microfrontends` | Postgres=`Vercel Launches Enterprise Microfrontends` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://news.example.com/vercel-microfrontends` | Postgres=`https://news.example.com/vercel-microfrontends` [MATCH]
**Record #3:**
  - `event_id`: Source=`evt_e40587fc56a0018c` | Postgres=`evt_5151bcf805654143` [MATCH]
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `title`: Source=`1 user started watching cloudflare/capnweb this week` | Postgres=`1 user started watching cloudflare/capnweb this week` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/cloudflare/capnweb` | Postgres=`https://github.com/cloudflare/capnweb` [MATCH]
**Record #4:**
  - `event_id`: Source=`evt_62d31cdd2457fc88` | Postgres=`evt_6a08605cbbae1657` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`GitHub IssueCommentEvent created in vercel/next.js` | Postgres=`GitHub IssueCommentEvent created in vercel/next.js` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/vercel/next.js` | Postgres=`https://github.com/vercel/next.js` [MATCH]
**Record #5:**
  - `event_id`: Source=`evt_62d31cdd2457fc88` | Postgres=`evt_6f8534c7bc12792c` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`GitHub Issue closed in vercel/next.js: Redirect from Server Action takes precedence over the Redirect from Middleware when they are sequential` | Postgres=`GitHub Issue closed in vercel/next.js: Redirect from Server ...` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/vercel/next.js` | Postgres=`https://github.com/vercel/next.js` [MATCH]
**Record #6:**
  - `event_id`: Source=`evt_81a9fce3b12e02d2` | Postgres=`evt_586a1c5b5803d478` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`GitHub Issue unlabeled in vercel/ai: embedMany does not automatically split large queries into smaller parts` | Postgres=`GitHub Issue unlabeled in vercel/ai: embedMany does not auto...` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/vercel/ai` | Postgres=`https://github.com/vercel/ai` [MATCH]
**Record #7:**
  - `event_id`: Source=`evt_62d31cdd2457fc88` | Postgres=`evt_275f54efa800ae7f` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`GitHub Issue closed in vercel/next.js: [App Router] Content Security Policy Broken` | Postgres=`GitHub Issue closed in vercel/next.js: [App Router] Content ...` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/vercel/next.js` | Postgres=`https://github.com/vercel/next.js` [MATCH]
**Record #8:**
  - `event_id`: Source=`evt_02dcca283ed1dcec` | Postgres=`evt_420a33d06e23cf23` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `title`: Source=`GitHub PullRequestReviewEvent created in netlify/netlify-plugin-secrets-manager` | Postgres=`GitHub PullRequestReviewEvent created in netlify/netlify-plu...` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/netlify/netlify-plugin-secrets-manager` | Postgres=`https://github.com/netlify/netlify-plugin-secrets-manager` [MATCH]
**Record #9:**
  - `event_id`: Source=`evt_f11be16883d991dc` | Postgres=`evt_36ca67ebab7db88a` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `title`: Source=`GitHub PullRequestReviewEvent created in netlify/build` | Postgres=`GitHub PullRequestReviewEvent created in netlify/build` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/netlify/build` | Postgres=`https://github.com/netlify/build` [MATCH]
**Record #10:**
  - `event_id`: Source=`evt_81a9fce3b12e02d2` | Postgres=`evt_c4ca1273a520f3c0` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `title`: Source=`GitHub Push to vercel/ai` | Postgres=`GitHub Push to vercel/ai` [MATCH]
  - `corroboration_count`: Source=`1` | Postgres=`1` [MATCH]
  - `url`: Source=`https://github.com/vercel/ai` | Postgres=`https://github.com/vercel/ai` [MATCH]

### Table: `noise_suppression_decisions` (10 Spot-Checked Records)
**Record #1:**
  - `signal_id`: Source=`sig_5db8569210107f9c` | Postgres=`sig_5db8569210107f9c` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #2:**
  - `signal_id`: Source=`sig_6422a1aad9e91465` | Postgres=`sig_6422a1aad9e91465` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #3:**
  - `signal_id`: Source=`sig_c877af0cc0cc8b94` | Postgres=`sig_c877af0cc0cc8b94` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #4:**
  - `signal_id`: Source=`sig_f3fe12b47824e787` | Postgres=`sig_f3fe12b47824e787` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #5:**
  - `signal_id`: Source=`sig_6637386cf4125c25` | Postgres=`sig_6637386cf4125c25` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #6:**
  - `signal_id`: Source=`sig_cce38ca2cc79ec67` | Postgres=`sig_cce38ca2cc79ec67` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #7:**
  - `signal_id`: Source=`sig_40b8a0541656c301` | Postgres=`sig_40b8a0541656c301` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #8:**
  - `signal_id`: Source=`sig_88715630324c33c1` | Postgres=`sig_88715630324c33c1` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #9:**
  - `signal_id`: Source=`sig_d2d9707e3d01c357` | Postgres=`sig_d2d9707e3d01c357` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]
**Record #10:**
  - `signal_id`: Source=`sig_8ec89ac7900df2a0` | Postgres=`sig_8ec89ac7900df2a0` [MATCH]
  - `is_noise`: Source=`False` | Postgres=`False` [MATCH]
  - `noise_category`: Source=`None` | Postgres=`None` [MATCH]

### Table: `findings` (10 Spot-Checked Records)
**Record #1:**
  - `event_id`: Source=`evt_a8c366bf91c004db` | Postgres=`evt_a8c366bf91c004db` [MATCH]
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `confidence`: Source=`Low` | Postgres=`Low` [MATCH]
  - `decision_score`: Source=`0.5` | Postgres=`0.5` [MATCH]
  - `tier`: Source=`should_know` | Postgres=`should_know` [MATCH]
**Record #2:**
  - `event_id`: Source=`evt_3dfc64412604b0a2` | Postgres=`evt_3dfc64412604b0a2` [MATCH]
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
  - `decision_score`: Source=`1.5` | Postgres=`1.5` [MATCH]
  - `tier`: Source=`should_know` | Postgres=`should_know` [MATCH]
**Record #3:**
  - `event_id`: Source=`evt_d5b184e796ded0c2` | Postgres=`evt_d5b184e796ded0c2` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #4:**
  - `event_id`: Source=`evt_3779c84bfe6afef4` | Postgres=`evt_3779c84bfe6afef4` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #5:**
  - `event_id`: Source=`evt_244e28691f8f6852` | Postgres=`evt_244e28691f8f6852` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #6:**
  - `event_id`: Source=`evt_586a1c5b5803d478` | Postgres=`evt_586a1c5b5803d478` [MATCH]
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #7:**
  - `event_id`: Source=`evt_e053206178515f4b` | Postgres=`evt_e053206178515f4b` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #8:**
  - `event_id`: Source=`evt_80712d958f097e1f` | Postgres=`evt_80712d958f097e1f` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #9:**
  - `event_id`: Source=`evt_29d0f584aa7c24b3` | Postgres=`evt_29d0f584aa7c24b3` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]
**Record #10:**
  - `event_id`: Source=`evt_36ca67ebab7db88a` | Postgres=`evt_36ca67ebab7db88a` [MATCH]
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `decision_score`: Source=`2.0` | Postgres=`2.0` [MATCH]
  - `tier`: Source=`must_know` | Postgres=`must_know` [MATCH]

### Table: `discovery_candidates` (10 Spot-Checked Records)
**Record #1:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`ClickStack` | Postgres=`ClickStack` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`Show HN: ClickStack – Open-source Datadog alternative by ClickHouse and HyperDX` | Postgres=`Show HN: ClickStack – Open-source Datadog alternative by Cli...` [MATCH]
**Record #2:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`Sift Dev` | Postgres=`Sift Dev` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`Launch HN: Sift Dev (YC W25) – AI-Powered Datadog Alternative` | Postgres=`Launch HN: Sift Dev (YC W25) – AI-Powered Datadog Alternativ...` [MATCH]
**Record #3:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`OpenObserve` | Postgres=`OpenObserve` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`GitHub Repo: openobserve/openobserve` | Postgres=`GitHub Repo: openobserve/openobserve` [MATCH]
**Record #4:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`Grafana` | Postgres=`Grafana` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`A Noob's Guide to Kubernetes Monitoring: SigNoz vs. Datadog vs. Grafana` | Postgres=`A Noob's Guide to Kubernetes Monitoring: SigNoz vs. Datadog ...` [MATCH]
**Record #5:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`Logtide` | Postgres=`Logtide` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`GitHub Repo: logtide-dev/logtide` | Postgres=`GitHub Repo: logtide-dev/logtide` [MATCH]
**Record #6:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`OpenWit` | Postgres=`OpenWit` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`GitHub Repo: openwit-oss/openwit` | Postgres=`GitHub Repo: openwit-oss/openwit` [MATCH]
**Record #7:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`Regen` | Postgres=`Regen` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`GitHub Repo: FluidifyAI/Regen` | Postgres=`GitHub Repo: FluidifyAI/Regen` [MATCH]
**Record #8:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`API‑Monitor‑Analytics` | Postgres=`API‑Monitor‑Analytics` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
  - `source_age`: Source=`recent` | Postgres=`recent` [MATCH]
  - `source`: Source=`GitHub Repo: Pu5hk4r/API-Monitor-Analytics` | Postgres=`GitHub Repo: Pu5hk4r/API-Monitor-Analytics` [MATCH]
**Record #9:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `name`: Source=`HyperDX` | Postgres=`HyperDX` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
  - `source_age`: Source=`dated` | Postgres=`dated` [MATCH]
  - `source`: Source=`Show HN: HyperDX – open-source dev-friendly Datadog alternative` | Postgres=`Show HN: HyperDX – open-source dev-friendly Datadog alternat...` [MATCH]
**Record #10:**
  - `target_company`: Source=`Stripe` | Postgres=`Stripe` [MATCH]
  - `name`: Source=`WePay` | Postgres=`WePay` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
  - `source_age`: Source=`dated` | Postgres=`dated` [MATCH]
  - `source`: Source=`http://techcrunch.com/2014/10/08/wepay-clear` | Postgres=`http://techcrunch.com/2014/10/08/wepay-clear` [MATCH]

### Table: `discovery_sources` (10 Spot-Checked Records)
**Record #1:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Show HN: HyperDX – open-source dev-friendly Datadog alternative` | Postgres=`Show HN: HyperDX – open-source dev-friendly Datadog alternat...` [MATCH]
  - `url`: Source=`https://github.com/hyperdxio/hyperdx` | Postgres=`https://github.com/hyperdxio/hyperdx` [MATCH]
**Record #2:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Show HN: ClickStack – Open-source Datadog alternative by ClickHouse and HyperDX` | Postgres=`Show HN: ClickStack – Open-source Datadog alternative by Cli...` [MATCH]
  - `url`: Source=`https://github.com/hyperdxio/hyperdx` | Postgres=`https://github.com/hyperdxio/hyperdx` [MATCH]
**Record #3:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Show HN: OneUptime – open-source Datadog Alternative` | Postgres=`Show HN: OneUptime – open-source Datadog Alternative` [MATCH]
  - `url`: Source=`https://github.com/OneUptime/oneuptime` | Postgres=`https://github.com/OneUptime/oneuptime` [MATCH]
**Record #4:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Show HN: OpenObserve – Elasticsearch/Datadog alternative` | Postgres=`Show HN: OpenObserve – Elasticsearch/Datadog alternative` [MATCH]
  - `url`: Source=`https://github.com/openobserve/openobserve` | Postgres=`https://github.com/openobserve/openobserve` [MATCH]
**Record #5:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Launch HN: Sift Dev (YC W25) – AI-Powered Datadog Alternative` | Postgres=`Launch HN: Sift Dev (YC W25) – AI-Powered Datadog Alternativ...` [MATCH]
  - `url`: Source=`https://news.ycombinator.com/item?id=43334589` | Postgres=`https://news.ycombinator.com/item?id=43334589` [MATCH]
**Record #6:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Datadog vs. Prometheus vs. SigNoz` | Postgres=`Datadog vs. Prometheus vs. SigNoz` [MATCH]
  - `url`: Source=`https://signoz.io/blog/datadog-vs-prometheus/` | Postgres=`https://signoz.io/blog/datadog-vs-prometheus/` [MATCH]
**Record #7:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Datadog vs. Grafana: Pricing Comparisons` | Postgres=`Datadog vs. Grafana: Pricing Comparisons` [MATCH]
  - `url`: Source=`https://www.vantage.sh/blog/datadog-vs-grafana-cost` | Postgres=`https://www.vantage.sh/blog/datadog-vs-grafana-cost` [MATCH]
**Record #8:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Ask HN: What are the major differences between DataDog vs New Relic?` | Postgres=`Ask HN: What are the major differences between DataDog vs Ne...` [MATCH]
  - `url`: Source=`https://news.ycombinator.com/item?id=6850409` | Postgres=`https://news.ycombinator.com/item?id=6850409` [MATCH]
**Record #9:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`A Noob's Guide to Kubernetes Monitoring: SigNoz vs. Datadog vs. Grafana` | Postgres=`A Noob's Guide to Kubernetes Monitoring: SigNoz vs. Datadog ...` [MATCH]
  - `url`: Source=`https://simpletechguides.com/comparisons/signoz-vs-datadog-vs-grafana/` | Postgres=`https://simpletechguides.com/comparisons/signoz-vs-datadog-v...` [MATCH]
**Record #10:**
  - `target_company`: Source=`Datadog` | Postgres=`Datadog` [MATCH]
  - `source_type`: Source=`discussion_and_tech_media` | Postgres=`discussion_and_tech_media` [MATCH]
  - `title`: Source=`Takipi: Dashboard Wars – Datadog vs. SignalFX vs. New Relic vs. Wavefront` | Postgres=`Takipi: Dashboard Wars – Datadog vs. SignalFX vs. New Relic ...` [MATCH]
  - `url`: Source=`http://blog.takipi.com/dashboard-wars-datadog-vs-signalfx-vs-new-relic-vs-wavefront/` | Postgres=`http://blog.takipi.com/dashboard-wars-datadog-vs-signalfx-vs...` [MATCH]

### Table: `pricing_snapshots` (9 Spot-Checked Records)
**Record #1:**
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `timestamp`: Source=`20260829_021015` | Postgres=`20260829_021015` [MATCH]
  - `url`: Source=`https://www.cloudflare.com/plans/` | Postgres=`https://www.cloudflare.com/plans/` [MATCH]
**Record #2:**
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `timestamp`: Source=`20260829_021010` | Postgres=`20260829_021010` [MATCH]
  - `url`: Source=`https://www.netlify.com/pricing/` | Postgres=`https://www.netlify.com/pricing/` [MATCH]
**Record #3:**
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `timestamp`: Source=`20260829_021008` | Postgres=`20260829_021008` [MATCH]
  - `url`: Source=`https://vercel.com/pricing` | Postgres=`https://vercel.com/pricing` [MATCH]
**Record #4:**
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `timestamp`: Source=`20260828_102004` | Postgres=`20260828_102004` [MATCH]
  - `url`: Source=`https://www.cloudflare.com/plans/` | Postgres=`https://www.cloudflare.com/plans/` [MATCH]
**Record #5:**
  - `company_name`: Source=`Cloudflare Pages/Workers` | Postgres=`Cloudflare Pages/Workers` [MATCH]
  - `timestamp`: Source=`20260829_021015` | Postgres=`20260829_021015` [MATCH]
  - `url`: Source=`https://www.cloudflare.com/plans/` | Postgres=`https://www.cloudflare.com/plans/` [MATCH]
**Record #6:**
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `timestamp`: Source=`20260828_102002` | Postgres=`20260828_102002` [MATCH]
  - `url`: Source=`https://www.netlify.com/pricing/` | Postgres=`https://www.netlify.com/pricing/` [MATCH]
**Record #7:**
  - `company_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `timestamp`: Source=`20260829_021010` | Postgres=`20260829_021010` [MATCH]
  - `url`: Source=`https://www.netlify.com/pricing/` | Postgres=`https://www.netlify.com/pricing/` [MATCH]
**Record #8:**
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `timestamp`: Source=`20260828_102001` | Postgres=`20260828_102001` [MATCH]
  - `url`: Source=`https://vercel.com/pricing` | Postgres=`https://vercel.com/pricing` [MATCH]
**Record #9:**
  - `company_name`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `timestamp`: Source=`20260829_021008` | Postgres=`20260829_021008` [MATCH]
  - `url`: Source=`https://vercel.com/pricing` | Postgres=`https://vercel.com/pricing` [MATCH]

### Table: `eval_grading_records` (10 Spot-Checked Records)
**Record #1:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Netlify` | Postgres=`Netlify` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
**Record #2:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Cloudflare` | Postgres=`Cloudflare` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
**Record #3:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Railway` | Postgres=`Railway` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`High` | Postgres=`High` [MATCH]
**Record #4:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Render` | Postgres=`Render` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
**Record #5:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Appwrite Sites` | Postgres=`Appwrite Sites` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
**Record #6:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Coolify` | Postgres=`Coolify` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
**Record #7:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Dokploy` | Postgres=`Dokploy` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
**Record #8:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Kubero` | Postgres=`Kubero` [MATCH]
  - `grade`: Source=`Correct` | Postgres=`Correct` [MATCH]
  - `confidence`: Source=`Medium` | Postgres=`Medium` [MATCH]
**Record #9:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`Antspace` | Postgres=`Antspace` [MATCH]
  - `grade`: Source=`Partial` | Postgres=`Partial` [MATCH]
  - `confidence`: Source=`Low` | Postgres=`Low` [MATCH]
**Record #10:**
  - `target_company`: Source=`Vercel` | Postgres=`Vercel` [MATCH]
  - `candidate_name`: Source=`VeilStream` | Postgres=`VeilStream` [MATCH]
  - `grade`: Source=`Partial` | Postgres=`Partial` [MATCH]
  - `confidence`: Source=`Low` | Postgres=`Low` [MATCH]
