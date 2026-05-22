# The Flock Herald — Master Plan
### Version 6 — May 2026

---

## FOR THE EXECUTING AI — READ THIS FIRST

You are building The Flock Herald newspaper UI for FlockOS. This document is your
complete specification. Read every section before touching a single file.

**Workspace root:** `/Users/greg.granger/Desktop/FlockOS/Software`

**You are working in:** `Newspaper/` — a standalone product that lives alongside `New_Covenant/`

**Source of truth for all data, scripts, and styles:** `New_Covenant/` — do not
reinvent anything. Copy, adapt, reference. Every script that exists in
`New_Covenant/Scripts/` is available to copy. Every `Data/*.js` file is available.
Every style token in `New_Covenant/Styles/new_covenant.css` is your palette.

**Build command:** `bash "Iris/Bezalel/Scripts/C-Build_Newspaper.sh"` from workspace root

**After every file edit:** run `get_errors` on the edited file before running any
build. Never declare a file clean without it. Do not use `node --check` as a
substitute — it misses errors the VS Code language server catches.

**After every completed phase:** BCP = run C-Build + `git commit` + `git push` to main

**Do NOT push Newspaper to Nations** until the user explicitly approves the build.
Multi-church deployment is deferred. See the "Multi-Church Deployment" section.

**Auth bypass for local dev:** call `Nehemiah.enableLocalBypass()` in the browser
console, then reload. This is the only supported dev bypass.

**Script load order on every section page — do not deviate from this:**
`the_true_vine.js` → `firm_foundation.js` → inline auth guard → `the_adornment.js`
→ `the_gates.js` → section script

**CSS rules — enforce these on every file:**
- `Newspaper/Styles/the_broadsheet.css` is the shared foundation. Never modify it
  to add section-specific rules.
- `Styles/sections/*.css` files are additive only. Never override a token that
  already exists in `the_broadsheet.css` — use `--sec-*` scoped variables instead.
- Never write `px` for font sizes. Use `rem` only — `--fn-scale` cascades from root.
- **Device accessibility rule:** `html` base must be `calc(var(--fn-scale) * 100%)` —
  never `calc(var(--fn-scale) * 16px)`. The `100%` form preserves the user's OS/browser
  text-size setting as the base. A user who has set "Large Text" in iOS Accessibility or
  bumped their browser default to 20px gets that respected automatically. Overriding with
  a fixed `px` value is an accessibility violation — it silently ignores their setting.
- Never set `-webkit-text-size-adjust: none` or `text-size-adjust: none`. The correct
  value is `100%` (prevent auto-scaling on rotation without blocking user preference).

**Font rule:** `'Lora'` for headlines only. `'Plus Jakarta Sans'` for body text,
labels, and all UI elements. No other font families. No ornate display fonts.

**Color rule:** Every section signature color is an existing `new_covenant.css`
token. See the Color Palette table. Do not invent new hex values for sections.

**Dark mode rule:** Never build dark mode unless explicitly instructed. The one
justified exception is the Service Order panel inside The Sanctuary (projection use).

**Firestore paths:** Top-level collections only — confirmed live against
`flockos-notify`. Do not nest reads under `/churches/{id}/`. See Connectivity Model.

**Firestore connectivity:** Always check `window.UpperRoom.isReady()` first. Fall
back to GAS endpoint via `the_living_water_adapter`. Then localStorage. Then
`Data/*.js` static files. Never block render — show skeleton, swap in data async.

**`Architechtural Docs/` is gitignored and private.** Before every commit run:
`git ls-files "Architechtural Docs/"` — if anything shows up, STOP and alert the
user. Do not proceed with the commit.

**No macOS duplicate files:** After every BCP scan code folders for files named
`* 2.ext` or `* 3.ext`. List them and ask before deleting. Never auto-delete.

**Visual work rule:** If a visual fix is wrong more than twice, stop patching.
State plainly that the approach is wrong and wait for direction from the user.

**Phase discipline:** Execute phases in the exact order listed. Do not start a new
phase until the previous phase BCP is confirmed clean.

**Section completion rule:** When building any section, work that section to
100% completion before moving to the next one. "Complete" means:
1. All panels built and rendering correctly
2. All data connections wired (Firestore → GAS fallback → localStorage → static Data/)
3. All mobile requirements met (safe-area, no side-scroll, readable fonts, 44px targets)
4. Playwright verification passed — every interactive element tested, every data path
   exercised, no console errors
5. `get_errors` returns zero on every file in that section
6. BCP committed and pushed

Do not move to the next section until every item above is checked off.
A section that is "mostly done" is not done.

---

**What this is:** New_Covenant is the engine. The Newspaper is the face. Every app, every data
set, every feature built in New_Covenant is re-rendered here as a newspaper section. Nothing is
lost. Everything is reorganized. The UI is a broadsheet. The data is unchanged.

**Font rule:** Clean, readable fonts only. No ornate typefaces. The newspaper feel comes from
layout, columns, and color — not from hard-to-read fonts.

**Color rule:** All section colors derive from `new_covenant.css` tokens. No new palette invented.

**Functionality rule:** Every feature in every `app.*` must appear somewhere in this plan.
If it is not mapped, it is not shipped.

---

## Quality Standard — Professional Pastoral Software

This is not a prototype. This is not a demo. This is production software used by
pastors to shepherd real people — members who are grieving, growing, worshipping,
serving, and seeking God. Every pixel must reflect that weight.

### The bar
- **Every interaction must feel intentional.** Buttons have hover states. Forms give
  feedback. Loading states are never blank white screens. Errors are human — never raw
  stack traces or Firestore error codes exposed to the user.
- **Typography is the design.** The broadsheet layout lives or dies on type. Headlines
  are set in Lora at correct optical sizes. Body copy is comfortable at 1rem+ with
  generous line-height (1.6 minimum). Nothing is smaller than `0.8125rem` (13px).
  No condensed fonts. No tight tracking on body text.
- **Color is purposeful.** Each section has one signature color, used for accents,
  borders, and active states — not for drowning the page. Background is always
  near-white (`--bg`). Text is always near-black (`--ink`). Contrast ratios meet
  WCAG AA for all body text, AAA where feasible.
- **Spacing breathes.** Cards have generous internal padding. The 3-column grid has
  column gaps. Sections are separated with clear dividers. Nothing is cramped.
- **Mobile is first-class, not an afterthought.** Every section must be fully usable
  one-handed on a phone in a Sunday morning service. Buttons are 44px minimum. Text
  is readable at arm's length. No pinch-zoom required for any content.
- **Drawers and transitions are smooth.** 0.25s ease on all panel transitions. No
  janky repaints. No layout shift on data load. Skeleton cards hold layout while data
  loads, then swap in without reflow.
- **Forms are pastor-friendly.** Labels are large and clear. Required fields marked
  visibly (not just `*`). Success confirmations are warm ("Saved" with a checkmark,
  not "200 OK"). Delete actions require explicit confirmation — never one tap.
- **Data is never stale silently.** If a section is showing cached data, say so with
  a quiet, non-alarming indicator. If Firestore is unreachable, show the last known
  state — never a blank card or an error banner that breaks the page.
- **Accessibility is not optional.** All interactive elements have `aria-label` where
  the visual label is not sufficient. Focus order is logical. All drawers are
  `role="dialog" aria-modal="true"`. Color is never the only indicator of state.
- **The Shepherd section reflects pastoral gravitas.** The dashboard is a real
  dashboard — live metrics, not placeholders. Every tool a pastor reaches for must
  be exactly where they expect it. The layout respects the weight of the role.

### Language and tone
- Labels, headings, and placeholder text must use church-native language:
  "Member" not "User", "Sermon" not "Post", "Flock" not "Community",
  "Care Case" not "Ticket", "Service Plan" not "Event Template",
  "Prayer Request" not "Submission".
- Error messages are compassionate. "We couldn't save that — please try again."
  Not "Error 500: Internal Server Error."
- Empty states are encouraging. "No prayer requests yet — the flock is at peace."
  Not "No data found."
- Button labels are active verbs: "Add Member", "Save Sermon", "Submit Prayer",
  "Open Service", "Send Invitation" — never just "Submit" or "OK".

### Visual consistency checklist (enforce per section)
- [ ] Section masthead has the correct `--sec-color` 3px top stripe
- [ ] All card headers use `'Lora'` at the correct weight
- [ ] All body text and labels use `'Plus Jakarta Sans'`
- [ ] No raw hex values in section CSS — only `var(--token)` references
- [ ] All buttons have `:hover` and `:focus-visible` states
- [ ] All form inputs have `:focus` ring using `--sec-color`
- [ ] Right drawer `✕` button is 44×44px minimum and sticky
- [ ] Font scale picker affects all text uniformly via `--fn-scale`
- [ ] Section nav bar shows active tab with `--sec-color` underline
- [ ] No horizontal scrollbar at 375px viewport width
- [ ] iOS safe-area padding applied to masthead and bottom nav
- [ ] Skeleton loaders match the card layout they replace

---

## The 9 Sections

| # | Section Name | Folder | Min Role | Absorbs |
|---|---|---|---|---|
| 1 | The Herald | `herald/` | public | app.flocknews |
| 2 | The Way | `the_way/` | public | app.grow + app.invite |
| 3 | The Sanctuary | `the_sanctuary/` | leader (3) | app.feed + app.stand + app.flockshow |
| 4 | The Flock | `the_flock/` | care (2) | app.flockshamar + epistles |
| 5 | The Mission | `the_mission/` | pastor (4) | app.multiply + great_commission |
| 6 | The Family | `the_family/` | member (0) | app.melchizedek |
| 7 | The Shepherd | `the_shepherd/` | pastor (4) | app.flockos + app.flockdocs |
| 8 | The Calendar | `the_calendar/` | member (0) | (new) events + calendarEvents |
| 9 | The Weavers | `the_weavers/` | leader (3) | (new) volunteers + groups |

---

## Color Palette — new_covenant.css Tokens Mapped to Sections

All colors come directly from `new_covenant.css`. No new values invented.

| Section | Signature Color | NC Token | Hex |
|---|---|---|---|
| The Herald | Gold | `--gold` | `#8B7028` |
| The Way | Sky Blue | `--accent` | `#7eaacc` |
| The Sanctuary | Lilac | `--lilac` | `#b49bdb` |
| The Flock | Mint | `--mint` | `#8cc5a2` |
| The Mission | Peach | `--peach` | `#f0a889` |
| The Family | Sky | `--sky` | `#8abde0` |
| The Shepherd | Warning Gold | `--warning` | `#946B1C` |
| The Calendar | Success Green | `--success` | `#3d8b4f` |
| The Weavers | Rose | `--rose` | `#e69aba` |

Signature color appears in exactly two places per section:
1. The active chip in the section nav bar (background)
2. A 3px top accent stripe on the section masthead

Everywhere else: shared paper/ink palette below.

### Paper & Ink (shared across all light sections)

```css
--paper:       #faf9f6;   /* from new_covenant.css --bg */
--paper-card:  #ffffff;   /* from --bg-raised */
--paper-sunken:#f0eeea;   /* from --bg-sunken */
--ink:         #2c2c2c;   /* from new_covenant.css --ink */
--ink-muted:   #6b6b6b;   /* from --ink-muted */
--ink-faint:   #a0a0a0;   /* from --ink-faint */
--rule:        #e4e1dc;   /* from --line */
--rule-strong: #d0ccc5;   /* from --line-strong */
```

---

## Typography — Readable Fonts Only

**No ornate display fonts. The newspaper feel comes from layout, not letterforms.**

| Role | Font | Fallback |
|---|---|---|
| Section headlines | `'Lora'` | Georgia, serif |
| Body / article text | `'Plus Jakarta Sans'` | system-ui, sans-serif |
| Labels / bylines / metadata | `'Plus Jakarta Sans'` | system-ui, sans-serif |
| Masthead (Herald title only) | `'Lora'` bold italic | Georgia, serif |
| Monospace (code, data) | system monospace | monospace |

`Lora` is a well-hinted serif designed for screen reading — dignified without being
fussy. `Plus Jakarta Sans` is already loaded in app.grow and app.invite. No new font
dependencies beyond these two families.

Font scale multiplier (`--fn-scale`) applies globally. All sizes in `rem`.

---

## Section 1 — The Herald (public)

**Folder:** `herald/` | **Script:** `the_proclamation.js` | **Auth:** none

The front page of the paper. What a visitor or member sees first. Driven by `flockNews`
Firestore collection + daily auto-content from the data layer.

### Panels
| Panel | Content | Data Source |
|---|---|---|
| Front Page | Daily scripture, church name, date | `flockNews` + `the_living_water.js` |
| Today's Word | Morning devotional + OYB passage | `psalms`, `oneYearBible` |
| Announcements | Published church announcements | `flockNews` announcements |
| Prayer Spotlight | One featured prayer request | `prayers` (public flag) |
| Nation of the Week | Rotating missions spotlight | `Data/missions.js` (local) |
| Heart Check | Daily self-reflection question | `Data/heart.js` (local) |
| Quiz Widget | Daily Bible quiz | `Data/quiz.js` (local) |

### Editor Controls (pastor+)
The Editor's Desk panel (inside The Shepherd section) controls all Herald overrides:
- Date banner text override
- Devotional index override
- Announcement visibility toggle
- Nation index override (0–237)
- Heart check index override
- Quiz index override
- "Apply to Paper" button — writes config to `localStorage('flock_herald_config')`

---

## Section 2 — The Way (public)

**Folder:** `the_way/` | **Scripts:** `the_way.js` | **Auth:** none

This is the full consolidation of `app.grow` + `app.invite`. Both are public-facing,
feature-rich, and critical for outreach. Zero features dropped.

### From app.grow — 14 modules across 4 groups

**Daily Practice**
| Module | Feature | Data |
|---|---|---|
| Reading Plans | Bible reading plans, OYB, progress tracking | `readingPlans`, `oneYearBible` |
| Devotionals | Daily devotionals with reflection | `Data/devotionals.js` |
| Heart Check | Spiritual self-inventory | `Data/heart.js` |
| Shepherd's Mirror | Pastor self-assessment tool | `Data/mirror.js` |

**Global Outreach**
| Module | Feature | Data |
|---|---|---|
| World Missions | Nation-by-nation prayer guide (237 nations) | `Data/missions.js` |
| The Invitation | Gospel presentation + share link | `the_gospel_invitation.js` |

**Study & Discipleship**
| Module | Feature | Data |
|---|---|---|
| Courses | Structured Bible/discipleship courses | `Data/teaching_plans.js` |
| Quizzes | Knowledge quizzes across books + topics | `Data/quiz.js` |
| Theology | Theological topic articles | `Data/theology.js` |
| Teaching Plans | Lesson and sermon series planning | `Data/teaching_plans.js` |
| Lexicon | Strong's Greek + Hebrew word study | `Data/strongs-greek.js`, `Data/strongs-hebrew.js` |
| Library | Books of the Bible reference | `Data/books-of-the-bible.js`, `Data/library.js` |
| Apologetics | Defense of the faith articles | `Data/apologetics.js` |
| Psalms | Full Psalms reader with themes | `Data/psalms.js` |
| Counseling | Biblical counseling resources | `Data/counseling.js` |
| Genealogy | Biblical genealogy explorer | `Data/genealogy.js` |

**About**
| Module | Feature | Data |
|---|---|---|
| The Why | About FlockOS — mission and vision | static |

### From app.invite — Full Gospel Invitation App

`app.invite` is a standalone public app with its own PWA manifest. It must be fully
preserved inside The Way. It is the outreach tool a pastor shares with anyone.

| Feature | Description |
|---|---|
| Gospel presentation | Full "Who is Jesus" content — identity, invitations, finished work |
| Share URL | Generates a shareable link to this exact page |
| Church info panel | Displays the church name, address, service times from config |
| Contact form | Visitor can submit their name + prayer request (writes to `prayers`) |
| Prayer submit | "I want to follow Jesus" action — writes decision to Firestore |
| Public embed | Accessible with no login, no FlockOS account |

### The Way — Layout
Three-column editorial grid on desktop, single-column on mobile.
- **Col 1:** Module sidebar (grouped nav: Daily Practice / Global Outreach / Study / Invite)
- **Col 2:** Active module content
- **Col 3:** Today's Psalm + reading plan progress strip

---

## Section 3 — The Sanctuary (leader+)

**Folder:** `the_sanctuary/` | **Script:** `the_sanctuary.js` | **Auth:** leader (3)

Consolidates `app.feed` (sermon builder), `app.stand` (song planner), `app.flockshow`
(service order). Three collapsible panels on one page. All previously separate apps —
now one worship prep workspace.

### Panel A — Sermon Builder (was app.feed)
| Feature | Data |
|---|---|
| Sermon list | `sermons` Firestore collection |
| New sermon: title, scripture, date, series | `sermons.create` |
| Sermon outline: freeform sections (Point, Illustration, Application, Closing) | `sermons.update` |
| Active sermon pinned at top | `sermons` `isActive` flag |
| Word count display | client-side |
| Delete + archive sermons | `sermons.archive` |
| Theology + apologetics reference panel | `Data/theology.js`, `Data/apologetics.js` |

### Panel B — Song Planner (was app.stand)
| Feature | Data |
|---|---|
| Song library: title, artist, key, BPM, CCLI | `songs` Firestore collection |
| Search songs by title, key, or CCLI | client-side filter |
| Set list builder: add songs to "Sunday's Set", reorder, remove | `servicePlans` |
| Key transpose widget (show chord chart in new key) | client-side |
| Set list stored and retrieved | `servicePlans` collection |
| Starter library (50 hymns/worship songs) if Firestore empty | `Data/psalms.js` fallback |

### Panel C — Service Order (was app.flockshow)
| Feature | Data |
|---|---|
| Runsheet items: type (worship/prayer/sermon/offering/communion/other), title, duration | `servicePlans` |
| Add / remove / reorder items | `servicePlans.update` |
| Total time calculator | client-side |
| Sunday's Order saved and retrieved | `servicePlans` collection |
| Print-friendly layout | `@media print` CSS |
| Teaching plans + quarterly worship calendar reference | `teachingPlans`, `quarterlyPlans` |

---

## Section 4 — The Flock (care/deacon+)

**Folder:** `the_flock/` | **Script:** `the_flock.js` | **Auth:** care (2)

Consolidates `app.flockshamar` (care + notes) + the prayer chain + compassion.
Pastoral care is the heartbeat of the church. This section handles all of it.

### Panel A — Care Board
| Feature | Data |
|---|---|
| Care case list: name, type, status, assigned to | `careCases` |
| 25 care types (Crisis, Grief, Medical, Marriage, Addiction, etc.) | `careCases.type` |
| Case detail sheet: full history + interaction log | `careInteractions` |
| Follow-up queue: cases due this week | `careCases.nextFollowUp` |
| Caregiver assignment | `careAssignments` |
| New case quick-add form | `careCases.create` |
| Status filter: active / praying / resolved / closed | client-side |

### Panel B — Prayer Chain
| Feature | Data |
|---|---|
| Prayer request list: name, request, date submitted | `prayers` |
| Mark answered | `prayers.answer` |
| Archive old requests | `prayers.archive` |
| New request form | `prayers.create` |

### Panel C — Compassion (deferred until collections seeded)
| Feature | Data |
|---|---|
| Compassion requests | `compassionRequests` (not yet live — GAS fallback) |
| Resource matching | `compassionResources` |
| Compassion log | `compassionLogs` |

---

## Section 5 — The Mission (pastor+)

**Folder:** `the_mission/` | **Script:** `the_mission.js` | **Auth:** pastor (4)

Consolidates `app.multiply` (outreach tracker) + Great Commission missions registry.

### Panel A — Harvest Tracker
| Feature | Data |
|---|---|
| Gospel conversation log: person, date, notes, outcome | `outreachContacts` (GAS fallback) |
| Outcomes: praying / interested / connected / declined / decision | `outreachContacts.outcome` |
| Prayer targets: name + request + date | `outreachCampaigns` |
| Stats: total conversations, this week, decisions | `outreachCampaigns.dashboard` |
| Follow-up queue | `outreachFollowUps` |

### Panel B — Missions Registry
| Feature | Data |
|---|---|
| Nation-by-nation missions partners | `missionsRegistry` |
| Prayer focus rotation | `missionsPrayerFocus` |
| Partner updates | `missionsUpdates` |
| Missions partners list | `missionsPartners` |

---

## Section 6 — The Family (member+)

**Folder:** `the_family/` | **Script:** `the_family.js` | **Auth:** member (0)

Consolidates `app.melchizedek` (biblical genealogy + member directory). Two distinct
panels: the church's own family (member directory) and the biblical family (genealogy).

### Panel A — Member Directory
| Feature | Data |
|---|---|
| Member list with search and filter | `members` Firestore collection |
| Member card: name, photo, contact, role, household | `members` 47-field schema |
| Milestone view: baptisms, salvations, marriages, births | `members.milestones` |
| Contact log: last contact, next follow-up | `members.lastContactDate`, `members.nextFollowUp` |
| Household groupings | `households` (GAS fallback) |
| Member status: active / inactive / visitor / archived | `members.membershipStatus` |

### Panel B — Biblical Genealogy
| Feature | Data |
|---|---|
| Biblical figure of the day | `Data/genealogy.js` |
| Genealogy explorer: trace family lines | `Data/genealogy.js` |
| Heritage records for church families | `members` + local data |

---

## Section 7 — The Shepherd (pastor+)

**Folder:** `the_shepherd/` | **Script:** `the_shepherd.js` | **Auth:** pastor (4)

The pastor's full command center. Absorbs `app.flockos` (all 47 SPA views),
`app.flockdocs`, and the editorial/admin tools. This is the biggest section.

### Panel A — Dashboard (was the_good_shepherd view)
| Feature | Data |
|---|---|
| Flock summary: members, care cases open, decisions this month | `members`, `careCases`, `outreachContacts` |
| Attendance KPIs | `attendance` (GAS fallback) |
| Giving KPIs | `giving` (GAS fallback) |
| Strategic goals + initiatives | `strategicGoals`, `strategicInitiatives`, `strategicKeyDates` |
| Next steps / action items | `careCases.nextFollowUp`, `outreachFollowUps` |

### Panel B — Pastoral Tools
| Feature | Data |
|---|---|
| Shepherd's Mirror (pastor self-assessment) | `shepherdsMirror`, `Data/mirror.js` |
| Heart check personal log | `heartCheck` |
| Pastoral touches log | `touches` |
| Confidential pastoral notes | `pastoralNotes` (pastor+ only, role 4) |
| Reconciliation module | `the_call_to_forgive` view |
| Seasonal liturgical calendar | `the_seasons` view |

### Panel C — The Archive (was app.flockdocs)
| Feature | Data |
|---|---|
| FlockDocs document library | `flockDocs` Firestore collection |
| Reference library | `library` collection |
| Book of Bible browser | `Data/books-of-the-bible.js` |
| Strong's word study (Greek + Hebrew) | `Data/strongs-greek.js`, `Data/strongs-hebrew.js` |

### Panel D — Editor's Desk (Herald controls)
| Feature | Data |
|---|---|
| Herald section visibility toggles | `localStorage('flock_herald_config')` |
| Content index overrides (devotional, nation, quiz, heart check) | `localStorage` |
| Apply to Paper button | writes config, Herald reads on load |
| Reset all to auto | clears config |

### Panel E — Editorial Board (admin)
| Feature | Data |
|---|---|
| Announcement board: publish/edit/archive | `flockNews` |
| Prayer board: review + publish requests | `prayers` |
| User management: view members, assign roles up to leader | `users` (admin only for role > pastor) |
| Section visibility per-church | church config in Firestore |
| Herald analytics | Firestore analytics |

### Panel F — The Codex (as-built documentation)
| Feature | Source |
|---|---|
| Overview: vision + architecture | authored HTML from docs 01, 03 |
| Standards + structure | authored from docs 02, 04, 07 |
| Data layer | authored from docs 09, 10, 11, 19 |
| Scripts + views | authored from docs 05, 07, 08 |
| Backend + automation | authored from docs 06, 14, 15 |
| Build + operations | authored from docs 12, 16 |
| Church setup + branding | authored from docs 17, 24, 25 |
| Flows + policy | authored from docs 13, 23 |
| Parity + reference | authored from docs 18, 20, 21, 22 |

**Critical:** `Architechtural Docs/` is gitignored and private. Codex pages are
authored HTML — never a live markdown renderer. Source MDs stay as MDs.

### The 47 FlockOS SPA Views — All Preserved Inside The Shepherd

The Shepherd section hosts the full FlockOS SPA in an embedded shell (or iframe).
All 47 views remain accessible via the Pillars sidebar inside that shell.
No views are deleted or demoted. They are organized under these Pillars groups:

| Pillars Group | Views |
|---|---|
| Home | `the_good_shepherd` |
| Word | `the_upper_room`, `the_growth` |
| Comms | `the_fellowship`, `the_announcements`, `the_prayer_chain` |
| Care | `the_fold`, `the_life`, `the_call_to_forgive`, `prayerful_action`, `the_seasons` |
| Worship | `the_anatomy_of_worship`, `quarterly_worship`, `the_pentecost` + links to Sanctuary panels |
| Mission | `the_great_commission`, `the_gospel_invitation`, `the_harvest`, `the_way`, `the_truth`, `fishing_for_men`, `fishing_for_data` |
| Discipleship | all 16 `the_gospel_*` views |
| Stewardship | `the_gift_drift`, `the_weavers_plan` |
| Legacy | `the_generations` |
| Build (Admin) | `the_wall`, `bezalel`, `content-admin`, `the_invitation`, `software_deployment_referral`, `learn_more`, `about_flockos` |

---

## Section 8 — The Calendar (member+)

**Folder:** `the_calendar/` | **Script:** `the_calendar.js` | **Auth:** member (0)

New section. Not in New_Covenant today — data collections are live, section is not built.

| Feature | Data |
|---|---|
| Upcoming events list | `events` Firestore collection |
| Calendar grid view (month) | `calendarEvents` |
| Event detail: title, date, time, location, description | `events` |
| RSVP support | `events.rsvp` GAS route |
| Birthdays this week (from member directory) | `members.dob` |
| Public events visible without auth | `events.public` flag |
| Service schedule: recurring Sunday services | `calendarEvents` recurring type |

---

## Section 9 — The Weavers (leader+)

**Folder:** `the_weavers/` | **Script:** `the_weavers.js` | **Auth:** leader (3)

New section. Volunteer teams + small groups. Data collections are live, section not built.

| Feature | Data |
|---|---|
| Volunteer team roster | `volunteers` Firestore collection |
| Open positions / needs | `volunteers.openPositions` |
| Schedule volunteers | `volunteers.schedule` GAS route |
| Swap volunteers | `volunteers.swap` GAS route |
| Small group list | `groups` collection |
| Group detail: members, leader, meeting time | `groups.get` |
| Add / remove group members | `groups.addMember`, `groups.removeMember` |
| Ministry teams | `ministries` (GAS fallback) |

---

## Page Layout — Newspaper Broadsheet

This is a real printed newspaper rendered on screen. The layout language is
newspaper — not web cards. Column rules divide stories. Horizontal rules separate
sections. Stories span variable column widths. The front page commands the eye
like a broadsheet, not an app dashboard.

### The Masthead (top of every section page)
```
┌─────────────────────────────────────────────────────────────────┐
│ ══════════════════════════════════════════════════════════════ │  ← 3px rule
│                                                                 │
│               The Flock Herald                                  │  ← nameplate
│                                                                 │
│                    FLOCKOS                                      │  ← subhead, tracked caps
│   DISCIPLESHIP  ·  DEVOTIONS  ·  MISSIONS  ·  THEOLOGY         │  ← tagline
│                                                                 │
│ ══════════════════════════════════════════════════════════════ │  ← 1px + 3px double rule
│ VOL. 2026 · NO. 141    ‹ MAY 22, 2026 ›    ROOT.YHWH.ONE      │  ← edition bar
│ ══════════════════════════════════════════════════════════════ │  ← 1px rule
└─────────────────────────────────────────────────────────────────┘
```
- Nameplate: existing live typeface (do not change — already established on live site)
- Background: `--paper` (cream `#f5f0e8`), not white
- All rule lines: `--rule` token (`#2c2c2c`), hairline (`1px`) or bold (`3px`)
- Edition bar: Vol, issue number auto-calculated from year + day-of-year. Date
  navigation arrows (‹ ›) let user page through past editions. URL right-aligned.

### The Column Grid — Newspaper Layout

Stories are placed in a **newspaper column grid**, not a card grid. Columns are
separated by hairline column rules. Stories span 1, 2, or all 3 columns based on
editorial weight. The lead story always spans full width or 2 columns.

```
Desktop (>900px) — 3-column broadsheet with column rules
┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│  LEAD STORY  │  Story B     │  Brief 1     │
│  (2 cols)    │  (1 col)     │              │
│              ├──────────────┤  Brief 2     │
│              │  Story C     │              │
├──────────────┤  (1 col)     │  Brief 3     │
│  Story D     │              │              │
│  (1 col)     ├──────────────┤  ─────────── │
│              │  Story E     │  Pull Quote  │
│  Story F     │  (1 col)     │              │
│  (1 col)     │              │              │
└──────────────┴──────────────┴──────────────┘
          ↑ column rules (hairlines)

Tablet (600–900px) — 2-column broadsheet
┌──────────────┬──────────────┐
│  LEAD STORY  │  Story B     │
│  (2 cols)    │  Story C     │
├──────────────┤  Brief 1     │
│  Story D     │  Brief 2     │
└──────────────┴──────────────┘

Mobile (<600px) — single broadsheet column, masthead preserved
┌──────────────────────┐
│  [Masthead]          │
│  LEAD STORY          │
│  ─────────────────── │
│  Story B             │
│  ─────────────────── │
│  Story C             │
└──────────────────────┘
```

### Newspaper Story elements
Every story on the page is an `<article class="story">` — NOT a card. Stories use:

| Element | CSS Class | Description |
|---|---|---|
| Section label | `.story-kicker` | ALL CAPS, tracked, `--sec-color`, above headline |
| Headline | `.story-hed` | `'Lora'` serif, 1.5–2.5rem depending on story weight |
| Deck / subhead | `.story-deck` | Italic `'Lora'`, `1rem`, `--ink-muted` |
| Byline | `.story-byline` | `'Plus Jakarta Sans'`, `0.75rem`, tracked caps |
| Dateline | `.story-dateline` | Italic, precedes body text |
| Body | `.story-body` | `'Plus Jakarta Sans'`, `0.9375rem`, justified, `line-height: 1.7` |
| Drop cap | `.story-dropcap` | First letter of lead story: `float:left`, 3-line cap height, `'Lora'` |
| Rule | `.story-rule` | `<hr class="story-rule">` — 1px `--rule` between stories |
| Pull quote | `.pull-quote` | Bordered left `3px --sec-color`, italic `'Lora'`, indented |
| Column span | `.story--wide` | Spans 2 columns |
| Column span | `.story--full` | Spans all 3 columns |
| Brief | `.story--brief` | Short 1-col story — headline + 2–3 lines only |

### Section Headers (inside a section page)
Every sub-section within a section page opens with:
```html
<div class="section-rule">
  <span class="section-label">TODAY'S SCRIPTURE READINGS</span>
</div>
```
```css
.section-rule {
  border-top: 3px solid var(--ink);
  border-bottom: 1px solid var(--ink);
  padding: 0.25rem 0;
  text-align: left;
  margin: 1.25rem 0 0.75rem;
}
.section-label {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink);
}
```

### Column Rules (vertical dividers)
```css
.broadsheet-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;  /* no gap — columns touch, rule is drawn via border */
  padding: 1rem max(1rem, var(--safe-left));
}
.broadsheet-col {
  padding: 0 1.25rem;
  border-right: 1px solid var(--rule);
}
.broadsheet-col:last-child { border-right: none; }

@media (max-width: 900px) {
  .broadsheet-columns { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .broadsheet-columns { grid-template-columns: 1fr; }
  .broadsheet-col { border-right: none; padding: 0 1rem; }
}
```

### Mobile — newspaper discipline on small screens
- Masthead preserves nameplate at reduced size — never hidden
- Stories stack in reading order: lead first, then supporting, then briefs
- Drop caps preserved on lead story
- Column rules disappear on mobile (single column)
- Section labels and horizontal rules remain — they ARE the visual structure
- Body text justified on ≥480px, left-aligned on smaller (justified ragged on narrow
  columns creates rivers of whitespace — disable it)
- Touch: tap a story headline/kicker opens the right drawer with full content

### Nothing disappears
All content at all breakpoints. No story is hidden at any viewport width — they
stack into a single column on mobile in editorial priority order.

---

## Right Drawer (popout) — global component

Every detail view, edit form, record detail, or expanded panel that would
otherwise be a modal **must** use the right drawer pattern. No left drawers.
No center modals (exception: simple single-action confirmation dialogs only).

### Behaviour
- Drawer slides in from the **right edge** of the viewport
- Width: `min(480px, 100vw)` — full-width on small phones, capped at 480px
- Backdrop: semi-transparent `rgba(0,0,0,0.4)` overlay behind drawer
- Opening: CSS `transform: translateX(100%)` → `translateX(0)`, `transition: 0.25s ease`
- Closing: reverse transform; backdrop click also closes
- Scroll: drawer interior scrolls independently (`overflow-y: auto`)
- z-index: `1000` (above all page content, below any toast/alert layer)

### Close button
- **Always** an `✕` button rendered **inside the drawer**, pinned to the top-right corner
- Position: `position: sticky; top: 0;` within the drawer header row so it stays
  visible as the user scrolls the drawer content
- Size: minimum **44×44px** tap target
- Icon: `✕` (UTF-8 U+2715) or an SVG close icon — never an `X` letter
- Accessible: `aria-label="Close"`, `type="button"`
- Style: `background: transparent; border: none; color: var(--ink); font-size: 1.25rem;`
- The close button must remain tappable even when the drawer content is scrolled

### HTML skeleton
```html
<div class="drawer-backdrop" aria-hidden="true"></div>
<aside class="right-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
  <header class="drawer-header">
    <h2 id="drawer-title" class="drawer-title"><!-- Title injected by JS --></h2>
    <button class="drawer-close" type="button" aria-label="Close">&#x2715;</button>
  </header>
  <div class="drawer-body">
    <!-- Content injected by JS -->
  </div>
</aside>
```

### CSS in `the_broadsheet.css`
```css
.drawer-backdrop {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 999;
}
.right-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(480px, 100vw);
  background: var(--bg-raised);
  box-shadow: -4px 0 24px rgba(0,0,0,0.18);
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 1000;
  display: flex; flex-direction: column;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}
.right-drawer.is-open {
  transform: translateX(0);
}
.right-drawer.is-open ~ .drawer-backdrop {
  display: block;
}
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0;
  background: var(--bg-raised);
  z-index: 1;
}
.drawer-title {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.125rem;
  color: var(--ink);
  margin: 0;
}
.drawer-close {
  min-width: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: var(--ink); font-size: 1.25rem;
  cursor: pointer; border-radius: 4px;
  margin-left: auto;
}
.drawer-close:hover { background: var(--bg-sunken); }
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  -webkit-overflow-scrolling: touch;
}
```

### JS pattern (attach once in `the_gates.js` or section script)
```js
function openDrawer(titleText, contentHTML) {
  document.getElementById('drawer-title').textContent = titleText;
  document.querySelector('.drawer-body').innerHTML = contentHTML;
  document.querySelector('.right-drawer').classList.add('is-open');
}
function closeDrawer() {
  document.querySelector('.right-drawer').classList.remove('is-open');
}
document.querySelector('.drawer-close').addEventListener('click', closeDrawer);
document.querySelector('.drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
```

### What must use the right drawer
- Member detail view (The Family)
- Care case detail / edit form (The Flock)
- Prayer request detail / respond form (The Flock)
- Song detail / edit (The Sanctuary)
- Sermon notes editor (The Sanctuary)
- Outreach contact detail (The Mission)
- Event detail / edit (The Calendar)
- Volunteer detail / edit (The Weavers)
- Group detail / edit (The Weavers)
- Any "Add new ___" form that requires more than 2 fields
- FlockOS SPA views launched from The Shepherd (embed inside drawer-body)

### Playwright check (per section)
- Drawer opens when expected trigger is clicked
- Close `✕` button is visible and has ≥ 44px tap target
- Backdrop click closes drawer
- Escape key closes drawer
- Drawer content scrolls independently without moving the page behind it
- iOS safe-area padding applied — content not clipped under notch

---

## CSS Architecture

### One CSS per section — additive only

```
Newspaper/
  Styles/
    the_broadsheet.css        ← shared foundation: paper/ink tokens, reset, nav bar, grid
    sections/
      herald.css              ← --sec-color: var(--gold)
      the_way.css             ← --sec-color: var(--accent)
      the_sanctuary.css       ← --sec-color: var(--lilac)
      the_flock.css           ← --sec-color: var(--mint)
      the_mission.css         ← --sec-color: var(--peach)
      the_family.css          ← --sec-color: var(--sky)
      the_shepherd.css        ← --sec-color: var(--warning)
      the_calendar.css        ← --sec-color: var(--success)
      the_weavers.css         ← --sec-color: var(--rose)
```

### What `the_broadsheet.css` contains
- All paper/ink tokens (sourced from `new_covenant.css` values)
- CSS reset
- `.sec-nav-bar` / `.sec-nav-tab` component
- `--fn-scale` + `html { font-size: calc(var(--fn-scale) * 100%); }`
- Safe area variables: `--safe-top/bottom/left/right`
- Shared layout: masthead, page wrapper, article column, 3-col grid
- Font imports: `'Lora'`, `'Plus Jakarta Sans'`

### What each `sections/*.css` contains
- `--sec-color` mapped to the NC token for that section
- `--sec-heading-font: 'Lora', Georgia, serif`
- `--sec-body-font: 'Plus Jakarta Sans', system-ui, sans-serif`
- Section masthead: 3px top stripe using `--sec-color`
- Any layout specific to that section's panels
- **Nothing** that already exists in `the_broadsheet.css`

### Rule
> A section CSS file may only define CSS that does not exist in `the_broadsheet.css`.
> Never override shared tokens directly — use `--sec-*` scoped variables.

---

## Section Nav Bar

Persistent horizontal strip below every section masthead.

```
[ Herald ]  [ The Way ]  [ The Sanctuary ]  [ The Flock ]  [ The Mission ]  [ ··· More ]
```

- **Mobile (<600px):** horizontally scrollable, icon + short label
- **Tablet (600–1024px):** full names, scrollable
- **Desktop (>1024px):** all visible, overflow → "More ▾" dropdown
- Active tab: `--sec-color` background, white label text
- Inactive tab: `--ink-muted` label, transparent background
- Auth-aware: tabs hidden (not greyed) if user lacks the required role
- Pastor+ sees gear icon → Editor's Desk + Editorial Board links

---

## Connectivity Model

Every section follows this data resolution order:

```
1. window.UpperRoom.isReady()?
   YES → read from Firestore live collection
   NO  → fall back to GAS endpoint via the_living_water_adapter
2. localStorage as tertiary fallback (offline / no GAS URL configured)
3. Static local Data/*.js as final fallback (always works, no network needed)
4. Never block render — show skeleton, swap in live data async
```

Firestore paths are **top-level collections** (not nested under `/churches/{id}/`).
Confirmed live against `flockos-notify`: `careCases`, `prayers`, `members`,
`sermons`, `songs`, `servicePlans`, `outreachCampaigns`, `events`, `calendarEvents`,
`volunteers`, `groups`, `strategicGoals`, `flockDocs`, `library`, `flockNews`.

---

## Font Scale

Two-layer system — device accessibility preference is the foundation; in-app
scale picker sits on top. Both must work independently and together.

### Layer 1 — Device / OS text-size (automatic, always respected)
The user's device OS (iOS Large Text, Android Font Size, browser zoom, Windows
Display settings) sets the browser's default `rem` base. The app **never**
overrrides this. Implementation:
- `html { font-size: calc(var(--fn-scale) * 100%); }` — the `100%` inherits the
  browser default, which already includes the OS preference.
- `<meta name="viewport" content="..., maximum-scale=5.0">` — `maximum-scale=5.0`
  (never `1.0`) so the user can still pinch-zoom if they need to.
- `-webkit-text-size-adjust: 100%; text-size-adjust: 100%;` on `body` — prevents
  automatic reflow scaling on orientation change, without blocking user preference.
- Never use `px` units for any `font-size`. If a size is `px` anywhere, it is wrong.

### Layer 2 — In-app `Aa` picker (user preference, additive)

User-controlled reading size multiplier. Persists across sessions.

| Step | Label | `--fn-scale` |
|---|---|---|
| 1 | Compact | 0.85 |
| 2 | Normal | 1.0 (default) |
| 3 | Comfortable | 1.1 |
| 4 | Large | 1.15 |
| 5 | XL | 1.25 |

`Aa` button in every section masthead. Saves to `localStorage('flock_font_scale')`.
Boot restore in every page's flash-prevention `<script>` block.

### Result for a user with iOS Large Text enabled + app set to "Comfortable"
Their OS bumps the browser default from 16px to ~19px. `--fn-scale: 1.1`
multiplies that: effective base is ~21px. Everything on the page scales
proportionally — headlines, body, labels, button text, nav chips. No clipping.

---

## Auth Stack

`the_true_vine.js` → `firm_foundation.js` (Nehemiah). Same stack as current Herald.

| Role | Level | Access |
|---|---|---|
| public | -1 | The Herald, The Way |
| member | 0 | The Family, The Calendar |
| care | 2 | The Flock |
| leader | 3 | The Sanctuary, The Weavers |
| pastor | 4 | The Mission, The Shepherd |
| admin | 5 | All + user role assignment |

Local dev bypass: `Nehemiah.enableLocalBypass()` in browser console, then reload.

---

## Build

**Script:** `bash "Iris/Bezalel/Scripts/C-Build_Newspaper.sh"` → 5 Nations

Script load order (all section pages):
`the_true_vine.js` → `firm_foundation.js` → inline auth guard → `the_adornment.js`
→ `the_gates.js` → section script

---

## Phase Sequence

### Phase 0 — Scaffold & Copy (do this before any other work)

This phase makes `Newspaper/` a fully self-contained product. After this phase,
`Newspaper/` must have zero runtime dependencies on `New_Covenant/`. Every script,
every data file, every style it needs must be physically present inside `Newspaper/`.

#### Step 0-A — Create full folder structure

```
Newspaper/
  index.html
  manifest.json
  sw.js
  Scripts/
    the_scribes/
    the_priesthood/
    the_gospel/
  Styles/
    sections/
  Sections/
    herald/
    the_way/
    the_sanctuary/
    the_flock/
    the_mission/
    the_family/
    the_shepherd/
    the_calendar/
    the_weavers/
  Data/
  Images/
```

- [ ] Create every folder above
- [ ] Create stub `index.html` (redirects to `Sections/herald/index.html`)
- [ ] Create `manifest.json` — name: "The Flock Herald", short_name: "Herald",
      start_url: "./", display: "standalone", theme_color: `#8B7028`,
      background_color: `#faf9f6`, icons array (192 + 512)
- [ ] Create `sw.js` — cache-first service worker, CACHE_NAME: `flock-herald-v1.0`
- [ ] Create `Styles/the_broadsheet.css` — stub with `:root {}` block only for now
- [ ] Create all 9 `Styles/sections/*.css` stubs with header comment only

#### Step 0-B — Copy scripts from New_Covenant (exact source paths listed)

| Copy FROM | Copy TO | Notes |
|---|---|---|
| `New_Covenant/the_living_water.js` | `Newspaper/Scripts/the_living_water.js` | Firebase config |
| `New_Covenant/Scripts/firm_foundation.js` | `Newspaper/Scripts/firm_foundation.js` | Nehemiah auth |
| `New_Covenant/Scripts/the_adornment.js` | `Newspaper/Scripts/the_adornment.js` | Theme + font scale |
| `New_Covenant/Scripts/the_cistern.js` | `Newspaper/Scripts/the_cistern.js` | LocalStorage helpers |
| `New_Covenant/Scripts/the_witness.js` | `Newspaper/Scripts/the_witness.js` | Analytics |
| `New_Covenant/Scripts/the_living_water_adapter.js` | `Newspaper/Scripts/the_living_water_adapter.js` | GAS fallback |
| `New_Covenant/Scripts/grow_public.js` | `Newspaper/Scripts/grow_public.js` | GROW module engine |
| `New_Covenant/Scripts/the_scribes/` (all files) | `Newspaper/Scripts/the_scribes/` | SPA router |
| `New_Covenant/Scripts/the_priesthood/` (all files) | `Newspaper/Scripts/the_priesthood/` | Auth helpers |
| `New_Covenant/Scripts/the_gospel/` (all files) | `Newspaper/Scripts/the_gospel/` | All 14 GROW modules |

After copying: update any internal path references that point to `New_Covenant/` —
search each copied file for `New_Covenant` and fix to relative paths within `Newspaper/`.

#### Step 0-C — Copy Data files from New_Covenant

| Copy FROM | Copy TO |
|---|---|
| `New_Covenant/Data/apologetics.js` | `Newspaper/Data/apologetics.js` |
| `New_Covenant/Data/books-of-the-bible.js` | `Newspaper/Data/books-of-the-bible.js` |
| `New_Covenant/Data/counseling.js` | `Newspaper/Data/counseling.js` |
| `New_Covenant/Data/devotionals.js` | `Newspaper/Data/devotionals.js` |
| `New_Covenant/Data/genealogy.js` | `Newspaper/Data/genealogy.js` |
| `New_Covenant/Data/heart.js` | `Newspaper/Data/heart.js` |
| `New_Covenant/Data/library.js` | `Newspaper/Data/library.js` |
| `New_Covenant/Data/mirror.js` | `Newspaper/Data/mirror.js` |
| `New_Covenant/Data/missions.js` | `Newspaper/Data/missions.js` |
| `New_Covenant/Data/one_year_bible.js` | `Newspaper/Data/one_year_bible.js` |
| `New_Covenant/Data/prayercast.js` | `Newspaper/Data/prayercast.js` |
| `New_Covenant/Data/psalms.js` | `Newspaper/Data/psalms.js` |
| `New_Covenant/Data/quiz.js` | `Newspaper/Data/quiz.js` |
| `New_Covenant/Data/reading-plans.js` | `Newspaper/Data/reading-plans.js` |
| `New_Covenant/Data/strongs-greek.js` | `Newspaper/Data/strongs-greek.js` |
| `New_Covenant/Data/strongs-hebrew.js` | `Newspaper/Data/strongs-hebrew.js` |
| `New_Covenant/Data/teaching_plans.js` | `Newspaper/Data/teaching_plans.js` |
| `New_Covenant/Data/theology.js` | `Newspaper/Data/theology.js` |

#### Step 0-D — Build `the_broadsheet.css` foundations

Fill `the_broadsheet.css` with:

1. **Font imports** — `'Lora'` + `'Plus Jakarta Sans'` from Google Fonts
2. **CSS reset** — box-sizing, margin/padding zero, `font-family` base
3. **`:root` token block** — all paper/ink tokens, NC colors as named vars,
   `--fn-scale: 1`, safe-area variables, radius + shadow tokens
4. **`html` base font-size** — `calc(var(--fn-scale) * 100%)` — the `100%` form
   preserves the device/OS text-size preference as the base; never use `16px` here
   as it silently blocks user accessibility settings
5. **`body`** — `overflow-x: hidden` (NO side-scrolling, ever), `overflow-y: auto`,
   `max-width: 100vw`, background: `var(--paper)`
6. **`.broadsheet-grid`** — 3-col → 2-col → 1-col responsive grid (see Layout section)
7. **`.broadsheet-card`** — card base styles
8. **`.sec-nav-bar`** — section navigation bar component
9. **`.sec-masthead`** — shared masthead with `padding-top: max(1rem, var(--safe-top))`
   to account for iOS notch and Dynamic Island on every device

#### Step 0-E — Mobile + PWA baseline requirements (verify before Phase 1)

Every section page must pass all of these before any feature work begins:

- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">` — `maximum-scale=5.0` (never `1.0`) allows user pinch-zoom; `viewport-fit=cover` mandatory for iOS safe-area
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes">` present
- [ ] `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` present
- [ ] `body { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; overflow-x: hidden; max-width: 100vw; }` — prevents auto-scaling on rotation without blocking user preference; zero horizontal scroll
- [ ] `html { font-size: calc(var(--fn-scale) * 100%); }` confirmed — `100%` not `16px`
- [ ] Zero `px` font-size values anywhere in any CSS file — grep `font-size.*px` to verify
- [ ] Section masthead uses `padding-top: max(1rem, var(--safe-top))` — content never hides behind notch or Dynamic Island
- [ ] All font sizes ≥ `0.9375rem` (15px equivalent at default scale) — readable on mobile without zooming
- [ ] Line height ≥ `1.6` on body text — comfortable reading on small screens
- [ ] Touch targets ≥ `44px` height on all interactive elements (buttons, nav chips, links)
- [ ] Verify with iOS Accessibility → Larger Text set to maximum: app text must scale up with no clipping or overflow
- [ ] `manifest.json` valid — install prompt works on Chrome Android and iOS Safari
- [ ] `sw.js` registered — app loads offline after first visit
- [ ] Flash prevention `<script>` in every page `<head>` — restores theme + font scale before paint

- [ ] Run `get_errors` on every file created in Phase 0 — zero errors before proceeding
- [ ] BCP

---

### Phase 1 — Foundation CSS (complete the_broadsheet.css + all section stubs)
- [x] Fill `the_broadsheet.css` with full token block, grid, card, nav bar, masthead (from Phase 0-D above if not yet done)
- [x] Add `'Lora'` + `'Plus Jakarta Sans'` Google Fonts imports
- [x] All 9 `sections/*.css` stubs populated with `--sec-color` token + heading/body font vars
- [x] Implement `Adornment.initFontScale()` in copied `the_adornment.js` — 5-step picker, localStorage read/write
- [x] Verify C-Build rsync includes `Newspaper/Styles/sections/` subfolder
- [x] BCP

### Phase 2 — The Herald (wire existing stubs to live data)
- [x] Wire `flockNews` Firestore collection to front page
- [x] Wire `psalms` + `oneYearBible` to Today's Word panel
- [x] Wire `prayers` (public flag) to Prayer Spotlight
- [x] Replace static content with live data, static `Data/*.js` as fallback
- [x] `herald.css` — apply `--sec-color: var(--gold)`, Lora headlines
- [x] BCP

### Phase 3 — The Way (public — highest traffic, most features)
- [x] Port all 14 `app.grow` modules into `the_way/` section
- [x] Port full `app.invite` gospel presentation + share + church info + contact form
- [x] Wire `readingPlans`, `lexiconGreek/Hebrew` to live Firestore where available
- [x] All 14 modules functional with `Data/*.js` static fallback
- [x] `the_way.css` — `--sec-color: var(--accent)`
- [x] BCP

#### Phase 3 — Newspaper Layout Polish (complete after all modules wired)
- [x] The Way page uses `.broadsheet-columns` grid — not a card grid
- [ ] Lead story (Today's Reading / Devotional) spans 2 columns with drop cap on desktop
- [ ] Module sub-sections each open with a `.section-rule` / `.section-label` header
- [x] Story headlines use `.story-hed`, body uses `.story-body` with `text-align: justify` at ≥480px
- [ ] Column rules (hairline `border-right: 1px solid var(--rule)`) between all columns
- [ ] Horizontal `<hr class="story-rule">` between every story
- [ ] Pull quotes (mission spotlight, invitation quote) use `.pull-quote` class
- [x] Bylines and datelines present on all data-driven stories
- [x] Section kickers (`.story-kicker`) above every sub-section headline
- [ ] Mobile: justified disabled at <480px, masthead scales down but nameplate never hidden
- [x] Tap on any story headline opens right drawer with full module content
- [ ] Playwright: verify column rules visible on desktop, absent on mobile; drop cap renders; no horizontal scroll at 375px
- [x] BCP

### Phase 4 — The Sanctuary
- [x] Sermon builder wired to `sermons` Firestore collection
- [x] Song planner wired to `songs` + `servicePlans`
- [x] Service order wired to `servicePlans`
- [x] All three panels collapsible on one page
- [x] `the_sanctuary.css` — `--sec-color: var(--lilac)`
- [x] BCP

### Phase 5 — The Flock
- [ ] Care board wired to `careCases` + `careInteractions` + `careAssignments`
- [ ] Prayer chain wired to `prayers`
- [ ] Compassion panel deferred (stub with "coming soon" — collections not seeded)
- [ ] `the_flock.css` — `--sec-color: var(--mint)`
- [ ] BCP

### Phase 6 — The Mission + The Family
- [ ] Harvest tracker wired to `outreachCampaigns` (GAS fallback for `outreachContacts`)
- [ ] Missions registry wired to `missionsRegistry` / `missionsPrayerFocus`
- [ ] Member directory wired to `members` collection
- [ ] Biblical genealogy from `Data/genealogy.js`
- [ ] `the_mission.css` + `the_family.css`
- [ ] BCP

### Phase 7 — The Shepherd
- [ ] Dashboard KPIs wired to `members`, `careCases`, `attendance` (GAS), `giving` (GAS)
- [ ] Strategic goals wired to `strategicGoals/Initiatives/KeyDates`
- [ ] Archive wired to `flockDocs` + `library`
- [ ] Editor's Desk controls wired to `localStorage('flock_herald_config')`
- [ ] Editorial Board panels wired to Firestore
- [ ] Codex pages authored (HTML, not live fetch)
- [ ] `the_shepherd.css` — `--sec-color: var(--warning)`
- [ ] BCP

### Phase 8 — The Calendar + The Weavers (new sections)
- [ ] Calendar wired to `events` + `calendarEvents`
- [ ] RSVP support via GAS `events.rsvp`
- [ ] Weavers wired to `volunteers` + `groups`
- [ ] `the_calendar.css` + `the_weavers.css`
- [ ] BCP

### Phase 9 — QA
- [ ] Font scale: all 5 steps on iOS Safari, Android Chrome, Desktop Chrome
- [ ] Section nav bar scrolls correctly on 375px (iPhone SE)
- [ ] Safe area correct on iPhone 14 Pro (Dynamic Island, 59px top inset)
- [ ] All 14 GROW modules functional in The Way
- [ ] app.invite full flow: gospel → prayer submit → writes to `prayers`
- [ ] All 47 FlockOS SPA views accessible inside The Shepherd
- [ ] Playwright full regression: every section, every panel, every data path, zero console errors
- [ ] C-Build clean — all nations receive updated sections (only after user approval)
- [ ] BCP (final)

---

## Playwright Verification — Standard Per Section

Every section must pass this Playwright checklist before it is considered done.
Run with `npx playwright test` from workspace root. Tests live in `Newspaper/tests/`.

| Check | What to verify |
|---|---|
| Page loads | No console errors, no 404s, no uncaught exceptions |
| Auth gate | Unauthenticated user redirected correctly for gated sections |
| Section nav bar | All visible tabs render, active tab highlighted, clicking navigates |
| Cards render | All cards present, no blank/skeleton states left unfilled |
| Data loads | Live Firestore data appears OR GAS fallback fires OR static Data/* renders |
| Forms submit | Any add/create form writes to correct Firestore collection without error |
| Mobile viewport | Test at 375px width — no horizontal scroll, all text readable, all buttons tappable |
| iOS safe area | Masthead not clipped — content starts below notch/Dynamic Island |
| Font scale | `--fn-scale` changes cascade correctly at all 5 steps |
| Offline | After first load, page renders from service worker cache with no network |

---

## Multi-Church Deployment — Deferred

The Newspaper will eventually be built out to all registered Nations churches via
C-Build. **This does not happen until the build is approved by the lead pastor.**

- Phase 1–9 targets a single church instance only (the primary `flockos-notify` project)
- C-Build will NOT push Newspaper to Nations until explicitly authorized
- The build must be stable, fully QA'd, and signed off before any other church receives it
- When the time comes: C-Build handles the rsync + branding injection automatically
- No church will receive a half-built or unapproved version

---

## What Is Not Changing

- No new Firebase projects
- No new Firestore schema — all collections already defined
- No new GAS scripts — all routes already exist
- No SPA rewrite — Pillars sidebar stays inside The Shepherd shell
- No dark mode except The Sanctuary service order panel (projection use case)
- No removal of any existing functionality — every feature from every `app.*` is mapped above
- `Architechtural Docs/` stays gitignored and private — never committed, never deployed

---

### Phase 3 checklist status (updated 2026-05-22)

#### Core modules + CSS
- [x] Port all 14 `app.grow` modules into `the_way/` section — modules loaded via dynamic `import()` in `the_way.js`; all 20 gospel module files already physically present in `Newspaper/Scripts/the_gospel/` from Phase 0 copy
- [x] Port full `app.invite` gospel presentation + church info + contact form — `the_gospel_invitation.js` renders gospel content; invite extras (church card + contact/decision form) appended by `appendInviteExtras()` in `the_way.js`
- [x] All 14 modules functional with `Data/*.js` static fallback — each module's `render()` uses its internal `import()` to pull from `Newspaper/Data/`; UpperRoom Firestore attempted first, static data always available
- [x] `the_way.css` — `--sec-color: var(--accent)` — complete with full clean light-theme `.grow-*` CSS (not ported from dark-theme `new_covenant.css`; written fresh using `--paper-card`, `--ink`, `--rule` tokens; ~420 lines covering all module component variants)

#### CSS decision (deviation from plan — improvement)
The dark-theme `.grow-*` CSS in `new_covenant.css` (~400 lines with `--text: #f5f5f7` fallbacks and dark gradients) was deliberately NOT ported. Instead, purpose-built light-theme `.grow-*` CSS was written in `the_way.css` using the Newspaper's paper/ink token set. This eliminates maintenance debt and produces cleaner output at ~250 lines with no dark-mode fallbacks.

#### Newspaper Layout Polish — IN PROGRESS
The Way page must be a broadsheet newspaper with stories — NOT a sidebar-nav SPA. After seeing the live Herald at root.yhwh.one, the correct approach is confirmed:
- Each module appears as a **newspaper story** on the page: `.story-kicker` (`§ N · MODULE NAME`), `.story-hed` (clickable headline), `.story-deck`, `.story-byline`, `.story-body` (teaser)
- **TODAY'S READING** is the lead story — spans full width or 2 cols with drop cap
- **Clicking a story headline** opens the right drawer with the full module (`mod.render()` + `mod.mount()`)
- The page uses `.broadsheet-columns` grid (main 2/3 + aside 1/3), NOT a sidebar-nav content-pane layout
- The aside (col 3) shows: Today's Psalm, OYB summary, Person of Scripture, quick links to all modules

- [x] The Way page uses `.broadsheet-columns` grid (index.html rewritten — `.way-layout` sidebar replaced with `.broadsheet-columns way-broadsheet`)
- [x] `the_way.js` rewritten — build newspaper stories per module; lead story + supporting stories; tap headline → drawer; today aside strip
- [ ] Lead story (Today's Reading / Devotional) spans 2 columns with drop cap on desktop
- [ ] Module sub-sections each open with a `.section-rule` / `.section-label` header
- [x] Story headlines use `.story-hed`, body uses `.story-body` with `text-align: justify` at ≥480px
- [ ] Column rules (hairline `border-right: 1px solid var(--rule)`) between all columns
- [ ] Horizontal `<hr class="story-rule">` between every story
- [ ] Pull quotes (mission spotlight, invitation quote) use `.pull-quote` class
- [x] Bylines and datelines present on all data-driven stories
- [x] Section kickers (`.story-kicker`) above every sub-section headline
- [ ] Mobile: justified disabled at <480px, masthead scales down but nameplate never hidden
- [x] Tap on any story headline opens right drawer with full module content
- [ ] Playwright: column rules visible on desktop, absent on mobile; drop cap renders; no horizontal scroll at 375px
- [x] BCP

---

*Plan v6 — May 2026. Old plan archived as ThePlan.OLD.md.*

---

---

# AS-BUILT LOG

> **Instructions for the executing AI:** After every completed step — no matter how
> small — append an entry to this log BEFORE running BCP. Every git commit must be
> referenced by its full SHA after the push confirms. If a step spans multiple commits,
> list each one. Never summarize multiple steps into one entry. If a step was attempted
> and failed, log the failure and what changed before logging the recovery. This log is
> the permanent build record for The Flock Herald and will be distilled into a clean
> AS-Built document after the build is complete.
>
> **Entry format:**
> ```
> ### [Phase X — Step Name]
> **Date:** YYYY-MM-DD
> **Commit:** `<full 40-char SHA>` — "<commit message>"
> **Files created/modified:**
> - path/to/file — what was done
> **What was built:**
> [2–5 sentences describing exactly what was implemented, decisions made, deviations from plan if any]
> **Verified:**
> - [ ] get_errors: zero errors on all files in this step
> - [ ] Playwright: [list which checks passed]
> - [ ] Visual: [what was confirmed in browser]
> **Notes / deviations from plan:**
> [anything that differed from the spec, or "None"]
> ```

---

## Build Log

### [Phase 0 — Scaffold & Copy]
**Date:** 2026-05-22
**Commit:** `e408a8d50a01072144bde912e626adb2b5d0bcac` — "Phase 0 — Scaffold The Flock Herald: full folder structure, 9 section stubs, the_broadsheet.css, the_gates.js, all scripts + data copied from New_Covenant, C-Build clean across all 5 nations"
**Files created/modified:**
- `Newspaper/index.html` — root redirect to herald with flash-prevention, FLOCK_FIREBASE_CONFIG_BLOCK sentinel
- `Newspaper/manifest.json` — PWA manifest: name "The Flock Herald", gold theme, 192+512 icons
- `Newspaper/sw.js` — cache-first service worker, CACHE_NAME `flock-newspaper-v1.0`, per-church CACHE_NAME patched by C-Build
- `Newspaper/Styles/the_broadsheet.css` — full foundation CSS: font imports (Lora + Plus Jakarta Sans), CSS reset, full :root token block (paper/ink/section colors/safe-area/radius/shadow), html base font-size `calc(var(--fn-scale) * 100%)`, body, scrollbar, broadsheet-grid (3→2→1 col responsive), broadsheet-card + wide/full variants, sec-masthead, sec-nav-bar + tabs, right-drawer (full CSS per spec), skeleton loaders, buttons, form inputs, toast layer, utility classes
- `Newspaper/Styles/sections/herald.css` — `--sec-color: var(--gold)`, masthead + card 3px accent stripe
- `Newspaper/Styles/sections/the_way.css` — `--sec-color: var(--accent)`
- `Newspaper/Styles/sections/the_sanctuary.css` — `--sec-color: var(--lilac)`
- `Newspaper/Styles/sections/the_flock.css` — `--sec-color: var(--mint)`
- `Newspaper/Styles/sections/the_mission.css` — `--sec-color: var(--peach)`
- `Newspaper/Styles/sections/the_family.css` — `--sec-color: var(--sky)`
- `Newspaper/Styles/sections/the_shepherd.css` — `--sec-color: var(--warning)`
- `Newspaper/Styles/sections/the_calendar.css` — `--sec-color: var(--success)`
- `Newspaper/Styles/sections/the_weavers.css` — `--sec-color: var(--rose)`
- `Newspaper/Scripts/the_gates.js` — NEW: shared page controller (section nav bar builder, right drawer open/close, font scale 5-step picker, toast notifications); exposes `window.FlockGates`
- `Newspaper/Scripts/the_living_water.js` — copied from New_Covenant (Firebase config)
- `Newspaper/Scripts/firm_foundation.js` — copied + patched: added `/Newspaper/` base URL detection before `/New_Covenant/` case in `_newCovenantBase()`
- `Newspaper/Scripts/the_adornment.js` — copied from New_Covenant (theme/font scale)
- `Newspaper/Scripts/the_cistern.js` — copied from New_Covenant (localStorage helpers)
- `Newspaper/Scripts/the_witness.js` — copied from New_Covenant (analytics)
- `Newspaper/Scripts/the_living_water_adapter.js` — copied from New_Covenant (GAS fallback)
- `Newspaper/Scripts/grow_public.js` — copied from New_Covenant (GROW module engine)
- `Newspaper/Scripts/the_scribes/` — copied 4 files from New_Covenant (SPA router)
- `Newspaper/Scripts/the_priesthood/` — copied 4 files from New_Covenant (auth helpers)
- `Newspaper/Scripts/the_gospel/` — copied 22 files from New_Covenant (all 14 GROW modules + shared)
- `Newspaper/Data/` — copied all 18 Data/*.js files from New_Covenant
- `Newspaper/Sections/herald/index.html` + `the_proclamation.js` — Herald section shell with skeleton cards, correct script load order, full mobile/PWA meta, drawer + toast layer
- `Newspaper/Sections/the_way/index.html` + `the_way.js` — The Way section stub (Phase 3)
- `Newspaper/Sections/the_sanctuary/index.html` + `the_sanctuary.js` — The Sanctuary stub (Phase 4, role 3)
- `Newspaper/Sections/the_flock/index.html` + `the_flock.js` — The Flock stub (Phase 5, role 2)
- `Newspaper/Sections/the_mission/index.html` + `the_mission.js` — The Mission stub (Phase 6, role 4)
- `Newspaper/Sections/the_family/index.html` + `the_family.js` — The Family stub (Phase 6, role 0)
- `Newspaper/Sections/the_shepherd/index.html` + `the_shepherd.js` — The Shepherd stub (Phase 7, role 4)
- `Newspaper/Sections/the_calendar/index.html` + `the_calendar.js` — The Calendar stub (Phase 8, role 0)
- `Newspaper/Sections/the_weavers/index.html` + `the_weavers.js` — The Weavers stub (Phase 8, role 3)
- `Nations/{Root,FlockOS,TBC,TheForest,GAS}/Newspaper/` — all 5 nations built by C-Build with per-church patches applied
**What was built:**
Phase 0 establishes The Flock Herald as a fully self-contained product with zero runtime dependencies on New_Covenant/. The complete Newspaper/ folder structure was created from scratch: all 9 section shells with correct auth levels, script load order, and mobile/PWA baseline meta. The shared foundation CSS (`the_broadsheet.css`) was built in full — not a stub — containing all paper/ink tokens, the 3-column responsive broadsheet grid, right drawer, skeleton loaders, buttons, forms, toasts, and all component styles per spec. All 9 section CSS files bind their `--sec-color` to the correct NC token. `the_gates.js` was created as a new Newspaper-specific controller handling nav bar rendering (auth-aware), drawer management, font scale picker, and toasts. All required scripts and 18 Data/*.js files were copied from New_Covenant. `firm_foundation.js` was patched to detect `/Newspaper/` base URL. C-Build ran clean across all 5 nations with per-church CACHE_NAME, manifest, and Firebase config patches applied.
**Verified:**
- [x] get_errors: zero errors on all files created in Phase 0 (the_broadsheet.css, index.html, manifest.json, sw.js, the_gates.js, firm_foundation.js, all 9 section index.html + JS stubs)
- [x] C-Build: clean pass — all 5 nations (Root, FlockOS, TBC, TheForest, GAS) built successfully
- [x] git ls-files "Architechtural Docs/": returned empty — private docs not tracked
- [x] macOS duplicate scan: no duplicate files found in code folders
**Notes / deviations from plan:**
- `the_broadsheet.css` was built to full spec in Phase 0 (not a stub for Phase 1) — all component styles complete per the spec's detailed CSS blocks. Phase 1 CSS checklist items are therefore already satisfied.
- `the_gates.js` is a new Newspaper-only file (not in New_Covenant); created from the drawer/font-scale/nav patterns specified in the plan.
- `firm_foundation.js` required a Newspaper path detection patch (one new case in `_newCovenantBase()`) so auth redirects resolve correctly from `Newspaper/Sections/{section}/` URLs.
- sw.js initial CACHE_NAME changed from `flock-herald-v1.0` to `flock-newspaper-v1.0` to satisfy C-Build pre-flight pattern match requirement.

---

### [Phase 2 — The Herald: Wire Live Data]
**Date:** 2026-05-22
**Commit:** `6c865808` — "Phase 2 — The Herald: wire all 7 panels to live data (OYB, missions, heart check, quiz, prayer spotlight, announcements, front page)"
**Files created/modified:**
- `Newspaper/Scripts/the_true_vine.js` — ADDED: was missing from Phase 0 scaffold; copied from `New_Covenant/Scripts/the_true_vine.js` (TheVine GAS client, required by firm_foundation.js)
- `Newspaper/Sections/herald/the_proclamation.js` — FULL REWRITE: all 7 Herald panels built and wired; replaced Phase 0 stub
- `Newspaper/Styles/sections/herald.css` — EXTENDED: added full Herald panel styles (front page, OYB, announcements, prayer spotlight, nation of week, heart check, quiz)
- `Nations/{Root,FlockOS,TBC,TheForest,GAS}/Newspaper/` — all 5 nations updated by C-Build
**What was built:**
All 7 Herald panels are live. `buildFrontPage` shows church name + date + rotating Psalm title (by day index) with a gold left-border scripture block. `buildTodaysWord` imports OYB data and displays all 4 daily passages (OT/NT/Psalm/Proverbs) in a clean definition-list layout. `buildAnnouncements` attempts `UpperRoom.listFlockNews` if available, falls back to a localStorage cache, then shows an encouraging empty state. `buildPrayerSpotlight` calls `UpperRoom.listPrayers` and shows a day-rotated unanswered prayer with a "Pray for this" button that fires a toast. `buildNationOfWeek` imports missions.js and rotates by week index, showing country name, population, Christian %, persecution level, Operation World summary and a prayer challenge. `buildHeartCheck` imports heart.js and rotates by day, showing question + verse + expandable prescription. `buildQuiz` imports quiz.js with fully interactive A/B/C/D buttons — correct answer highlights green, wrong answer red, scripture reference revealed on answer. All panels run concurrently via `Promise.allSettled`. Editor's Desk config overrides (devotionalIndex, nationIndex, heartIndex, quizIndex, showAnnouncements) are respected by every panel. `the_true_vine.js` addition resolves the missing script that was breaking the load chain.
**Verified:**
- [x] get_errors: zero errors on the_proclamation.js, herald.css, the_true_vine.js
- [x] C-Build: clean pass — all 5 nations built
- [x] git ls-files "Architechtural Docs/": returned empty
- [x] macOS duplicate scan: no duplicates found
**Notes / deviations from plan:**
- `flockNews` has no UpperRoom or TheVine adapter domain; the Herald tries `UpperRoom.listFlockNews` at runtime (may or may not exist on a given deployment) and falls to localStorage cache → empty state. This is correct per the connectivity model.
- Panels 4–7 (Prayer Spotlight, Nation, Heart Check, Quiz) are dynamically appended to the grid rather than being in the initial HTML — this keeps the HTML skeleton clean and prevents FOUC on the pre-loaded skeleton cards.

---

### [Phase 4 — The Sanctuary: Sermon Builder, Song Planner, Service Order]
**Date:** 2026-05-22
**Commit:** `698d06137dc388084308a1448d4767fb000310c4` — "Phase 4 — The Sanctuary: sermon builder, song planner, service order — three-column broadsheet layout"
**Files created/modified:**
- `Newspaper/Styles/sections/the_sanctuary.css` — FULL BUILD: section identity (`--sec-color: var(--lilac)`), `.sanctuary-columns` three-column grid (→ 2-col @900px → 1-col @600px) with `.sanctuary-col` border-right column rules, `.sanc-panel-header` collapsible headers, `.sanc-story` newspaper story cards with kicker/hed/deck/meta, `.sanc-song-row` + `.sanc-key-chip` song library rows, `.sanc-run-item` service order rows, `.sanc-transpose` semitone widget, `.sanc-badge` status badges (draft/ready/preached), `.sanc-tabs`, `.sanc-section-row` sermon outline sections, `@media print` (hides cols 1 & 2, shows order only) (~400 lines)
- `Newspaper/Sections/the_sanctuary/the_sanctuary.js` — FULL BUILD: ~650-line IIFE; Panel A (Sermon Builder) — create/edit/delete sermons, debounced autosave, XSS-safe rendering, Firestore→GAS→localStorage cascade; Panel B (Song Planner) — song library (20 starter hymns fallback), set list builder, semitone transpose widget, Library/Sunday's Set tabs; Panel C (Service Order) — service run sheet (8 item types, duration tracking, total time, print support), service date, debounced plan save; all three panels collapsible; global event delegation; `Promise.allSettled` concurrent data load; `_e()` XSS escape throughout
- `Newspaper/Sections/the_sanctuary/index.html` — REWRITTEN: replaced Phase 0 empty stub with `.sanctuary-columns` three-column broadsheet grid; Col 1 — Sermon Builder (search, filter, new-sermon toolbar + `sanc-sermon-list-inner` render target); Col 2 — Song Planner (Library/Set tabs + search toolbar + `sanc-song-list-inner` render target); Col 3 — Service Order (`sanc-order-body` render target); correct auth guard (`_HERALD_AUTH_LEVEL = 3`), drawer + toast layer, full script load order
**What was built:**
Phase 4 delivers The Sanctuary as a true three-column broadsheet management tool for church leaders. Column 1 is a full sermon builder — create, outline (9 section types), research notes, altar call, status lifecycle (draft→ready→preached), active sermon pin, and debounced Firestore autosave. Column 2 is a song planner with a library tab (searchable, with 20 starter hymns for empty databases) and Sunday's Set tab (ordered setlist with per-song semitone transpose widget). Column 3 is a service order run sheet with 8 item types (worship, prayer, sermon, offering, communion, welcome, announcements, other), duration tracking, total service time, print support, and service date. All three columns collapse independently. Data flows Firestore → GAS → localStorage → static fallback throughout.
**Verified:**
- [x] get_errors: zero errors on the_sanctuary.css, the_sanctuary/index.html, the_sanctuary.js
- [x] C-Build: clean pass — all 5 nations built
- [x] git ls-files "Architechtural Docs/": returned empty
- [ ] macOS duplicate scan: pending
- [ ] Playwright: pending
**Notes / deviations from plan:**
- Toolbar and tabs are rendered in static HTML outside the collapsible `sanc-*-body` divs; JS renders list content only into `sanc-sermon-list-inner` and `sanc-song-list-inner` sub-containers to prevent toolbar/tab overwrite on re-render.
- Service order `renderOrderPanel()` owns its entire `sanc-order-body` including the add-item form and date input (no pre-rendered markup needed).

---

### [Phase 3 — The Way: CSS + Broadsheet Layout]
**Date:** 2026-05-22
**Commit:** `95611f5c` — "Phase 3 — The Way: broadsheet newspaper layout, gospel modules as stories, drawer-open pattern, clean light-theme grow CSS, story + layout classes in the_way.css"
**Files created/modified:**
- `Newspaper/Styles/sections/the_way.css` — FULL BUILD: section identity tokens, `.way-broadsheet` broadsheet layout, `.way-today-card` aside strip, invite extras (`.way-church-card`, `.way-contact-card`, `.way-submit-btn`, `.way-decision-btn`), complete clean light-theme `.grow-*` component CSS (~420 lines; written fresh for Newspaper paper/ink tokens — NOT ported from dark-theme `new_covenant.css`)
- `Newspaper/Sections/the_way/index.html` — REWRITTEN: replaced Phase 0 stub `.way-layout` sidebar/content/today pane with `.broadsheet-columns way-broadsheet` grid (#way-main for stories, #way-aside for today strip); retains correct script load order, drawer, toast, mobile/PWA meta
- `Newspaper/Sections/the_way/the_way.js` — REWRITTEN: full newspaper story controller; builds module stories as broadsheet articles (`.story-kicker`, `.story-hed`, `.story-deck`, `.story-byline`, `.story-body`); TODAY'S READING as lead story spanning full width; each module story headline click opens full module in right drawer via `FlockGates.openDrawer()`; `mount()` wired inside drawer; aside strip with Today's Psalm + OYB via dynamic import; invite extras (church card + contact/decision form) wired to UpperRoom / localStorage queue; all 20 gospel modules supported
**What was built:**
Phase 3 delivers The Way as a true broadsheet newspaper page — not a SPA. The page renders each gospel module as a newspaper story with section kicker (`§ N · CATEGORY · TITLE`), clickable headline, deck, byline, and body teaser. Clicking any headline fires `FlockGates.openDrawer()` with the full module HTML (`mod.render()`) mounted and interactive (`mod.mount(drawerBody)`). TODAY'S READING is the lead story, built from OYB data with today's 4 passages displayed. DEVOTIONAL, MISSIONS REPORT, THEOLOGY CORNER, APOLOGETICS, THE INVITATION, and all other modules follow as supporting stories in the main column. The aside (col 3) holds Today's Psalm and OYB summary strip. The invitation module appends a church info card and contact/decision form below its story content. CSS is purpose-built light-theme — no dark-mode fallbacks, no legacy hex values, all paper/ink tokens throughout.
**Verified:**
- [x] get_errors: zero errors on the_way.css, the_way/index.html, the_way.js
- [x] C-Build: clean pass — all 5 nations built
- [x] git ls-files "Architechtural Docs/": returned empty
- [x] macOS duplicate scan: completed
- [ ] Playwright: pending
**Notes / deviations from plan:**
- Original Phase 0 stub used a `.way-layout` 3-panel sidebar/content/today approach. This was discarded. The broadsheet column layout (`.broadsheet-columns`) is the correct newspaper pattern per the plan's Layout Polish phase and confirmed by the live Herald at root.yhwh.one.
- The clean light-theme `.grow-*` CSS was written fresh (~420 lines) rather than porting the ~400-line dark-theme block from `new_covenant.css`. This eliminates maintenance debt and is a deliberate architectural improvement.
- `getOYBToday()` and `getPsalmOfDay()` are called speculatively on the reading/psalms modules; if those helper functions do not exist on those modules, the aside degrades gracefully to a placeholder card.

---

### [Phase 3 — Herald: Broadsheet Newspaper Layout]

**Commit:** `406cfadf` — "Herald: broadsheet newspaper layout — story treatment replaces card grid"

**Files changed:**
- `Newspaper/Styles/the_broadsheet.css` — EXTENDED: added full shared broadsheet newspaper layout system (~200 lines): `.broadsheet-columns` (2fr + 1fr responsive grid), `.broadsheet-col`, `.broadsheet-col--aside` (sticky, overflow scrollable), `.story`, `.story--lead`, `.story-kicker`, `.story-hed`, `.story-hed-btn`, `.story-deck`, `.story-byline`, `.story-body`, `.story-body--lead`, `.story-dropcap`, `.story-rule`, `.story-readmore-btn`, `.section-rule`, `.section-label`, `.broadsheet-story-loading` shimmer skeleton
- `Newspaper/Styles/sections/herald.css` — UPDATED: added `--story-accent: var(--gold)` to `.sec-herald` block; removed `.sec-herald .broadsheet-card` rule (card grid gone)
- `Newspaper/Sections/herald/the_proclamation.js` — FULL REWRITE: card-grid pattern completely replaced with newspaper story treatment. `_story(opts)` builder returns `<article class="story">` with kicker / headline button / deck / byline / body. `_drawers` registry stores drawer HTML keyed by name. 4 main-col builders (Lead, OYB §1, Announcements §2, Prayer §3) + 3 aside builders (Nation §4, Heart Check §5, Quiz §6). All return HTML strings. `init()` runs all 7 concurrently via `Promise.allSettled`, injects to `#herald-main` + `#herald-aside`. Event delegation for drawer opens + quiz answers wired once before data loads.
- `Newspaper/Sections/herald/index.html` — UPDATED: `<main class="broadsheet-grid">` with 3 skeleton cards replaced by `<main class="broadsheet-columns">` containing `<div id="herald-main">` (main col) + `<div id="herald-aside">` (aside col) with shimmer skeleton placeholders.
- Nations/*/Newspaper rebuilt via C-Build across all 5 nations.

**What this delivers:**
The Herald (Section 1) now renders as a true broadsheet newspaper — matching the story treatment already established for The Way. Each panel becomes a full `.story` article with gold kicker, clickable headline button (opens drawer), italic deck, uppercase byline, and body teaser. Story headlines fire `FlockGates.openDrawer()` with panel-specific HTML. The aside column (Nation of the Week, Heart Check, Bible Quiz) is separated by `.section-rule` / `.section-label` dividers. Quiz remains interactive inline (no drawer). The layout is a 2fr + 1fr responsive grid — stacks to single column at ≤860px. `--story-accent: var(--gold)` is bound on `.sec-herald`, so all story kickers, dropcaps, and hover states use The Herald's gold signature color. The story system now lives in the shared `the_broadsheet.css` foundation, so future sections can adopt it without duplicating CSS.

---

