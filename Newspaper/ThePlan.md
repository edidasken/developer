# The Newspaper — FlockOS Unified Experience Plan
### Version 3 — Comprehensive Build Document

**Vision:** The entire FlockOS product becomes one beautiful, newspaper-style unified experience. The Flock Herald is the front door and the editorial design language for everything. Every section of the paper is a FlockOS tool. You open the paper; you are already home.

---

## MASTER TO-DO LIST

> This list is the source of truth for execution. Mark `[x]` after each task is completed during a work session.

### Phase 0-A — Project Scaffold (do this first — everything else depends on it)
- [ ] PA-1: Create `Newspaper/` root folder at `/Users/greg.granger/Desktop/FlockOS/Software/Newspaper/`
- [ ] PA-2: Create folder structure: `Scripts/`, `Scripts/the_scribes/`, `Scripts/the_priesthood/`, `Styles/`, `Styles/sections/`, `Sections/`, `Images/`, `Data/`
- [ ] PA-3: Create all 16 section folders: `Sections/herald/`, `tabernacle/`, `pulpit/`, `levites/`, `stage/`, `epistles/`, `straight_path/`, `great_commission/`, `living_water/`, `scroll_room/`, `gatehouse/`, `genealogies/`, `harvest/`, `cornerstone/`, `editors_desk/`, `council/`
- [ ] PA-4: Copy `New_Covenant/the_living_water.js` → `Newspaper/Scripts/the_living_water.js`
- [ ] PA-5: Copy `New_Covenant/Scripts/firm_foundation.js` → `Newspaper/Scripts/firm_foundation.js`
- [ ] PA-6: Copy `New_Covenant/Scripts/the_adornment.js` → `Newspaper/Scripts/the_adornment.js` (update path refs after)
- [ ] PA-7: Copy `New_Covenant/Scripts/the_cistern.js` + `the_witness.js` → `Newspaper/Scripts/`
- [ ] PA-8: Copy `New_Covenant/Scripts/the_scribes/` (4 files) → `Newspaper/Scripts/the_scribes/`
- [ ] PA-9: Copy `New_Covenant/Scripts/the_priesthood/` (4 files) → `Newspaper/Scripts/the_priesthood/`
- [ ] PA-10: Create `Newspaper/Styles/the_broadsheet.css` with full palette token block (from §5)
- [ ] PA-11: Create `Newspaper/index.html` — stub Herald entry point
- [ ] PA-12: Create `Newspaper/manifest.json` + `Newspaper/sw.js`
- [ ] PA-13: Run get_errors on all copied JS files — confirm zero errors before proceeding
- [ ] PA-14: BCP

### Phase 0 — Foundation (CSS additions to `the_broadsheet.css`)
- [ ] P0-1: Create `Newspaper/Styles/sections/_README.md` with additive-only rule documented
- [ ] P0-2: Add `--fn-scale: 1` to `the_broadsheet.css` `:root`
- [ ] P0-3: Set `html { font-size: calc(var(--fn-scale) * 100%); }` in `the_broadsheet.css`
- [ ] P0-4: Implement `Adornment.initFontScale()` in `Newspaper/Scripts/the_adornment.js`
- [ ] P0-5: Confirm boot-restore pattern (theme + font scale iife) in `the_adornment.js`
- [ ] P0-6: Add iOS/Samsung safe-area CSS variables to `the_broadsheet.css` `:root`
- [ ] P0-7: Add `.safe-top/bottom/left/right` utility classes to `the_broadsheet.css`
- [ ] P0-8: Add `.sec-nav-bar` / `.sec-nav-tab` + active state to `the_broadsheet.css`
- [ ] P0-9: BCP

### Phase 1 — Herald & Section Bar
- [ ] P1-1: Create `sections/herald.css` with full standard header block
- [ ] P1-2: Extract Herald-specific typography from `flocknews.css` → `sections/herald.css`
- [ ] P1-3: Make `flocknews.css` a thin import shim (loads `../sections/herald.css`)
- [ ] P1-4: Replace "Select an App" dropdown in `flocknews.html` with `.sec-nav-bar`
- [ ] P1-5: Add font-scale `Aa` button to Herald masthead in `flocknews.html`
- [ ] P1-6: Add font-scale + theme boot restore to `flocknews.html` flash-prevention script
- [ ] P1-7: Convert all `flocknews.css` text sizes from `px` → `rem`
- [ ] P1-8: Apply `env(safe-area-inset-*)` to Herald masthead and section bar
- [ ] P1-9: Test Herald section bar on: iPhone SE (375px), iPhone 14 Pro (393px Dynamic Island), iPhone 14 Pro Max (430px), Samsung Galaxy S24 (360px)
- [ ] P1-10: BCP

### Phase 2 — News Editor Auth + Admin Page
- [ ] P2-1: Add `Nehemiah.guard()` auth gate to `news_editor.html` — minimum role: `pastor`
- [ ] P2-2: Add Firebase Auth init + `whoAmI()` boot to `news_editor.html`
- [ ] P2-3: Add auth header to `news_editor.html` showing user displayName + role badge
- [ ] P2-4: Add logout button to `news_editor.html`
- [ ] P2-5: Add font-scale + `env(safe-area-inset-*)` to `news_editor.html`
- [ ] P2-6: Create `sections/editor.css` — dark newsroom aesthetic (extends current `news_editor.css`)
- [ ] P2-7: Expand Editor's Desk controls to cover all Herald sections (see §A below)
- [ ] P2-8: Create `app.flocknews/admin.html` — "The Editorial Board" admin page (pastor+ only)
- [ ] P2-9: Create `sections/admin_board.css` for admin page
- [ ] P2-10: Add admin page link to section bar — hidden unless `Nehemiah.hasRole('pastor')` is true
- [ ] P2-11: BCP

### Phase 3 — Permission Tightening
- [ ] P3-1: Audit every Tier 1 HTML page — document its current auth state
- [ ] P3-2: Apply `Nehemiah.guard()` to all Tier 1 pages that require auth (see Permission Map §B)
- [ ] P3-3: Apply `Nehemiah.requireRole('pastor')` to Tier 1 admin-only sections
- [ ] P3-4: In the section bar, hide tabs the current user doesn't have access to (client-side via `Nehemiah.hasRole()`)
- [ ] P3-5: In `the_pillars.js` (FlockOS sidebar), hide nav items below user's role level
- [ ] P3-6: Confirm GROW learning modules (`the_gospel_*`) remain fully public in `app.grow.html` — no auth gate
- [ ] P3-7: Confirm The Invitation (`app.invite`) remains fully public
- [ ] P3-8: Confirm The Wellspring (`app.wellspring`) remains fully public
- [ ] P3-9: Add "access denied" soft page (newsprint style) for unauthorized section attempts
- [ ] P3-10: BCP

### Phase 4 — FlockOS Comms Absorption
- [ ] P4-1: Audit `Scripts/the_comms.js` — document all Firestore listeners/writes
- [ ] P4-2: Confirm each listener is covered by `flockchat-public/flockchat.js`
- [ ] P4-3: Replace the_comms Pillars entry in `the_pillars.js` with direct `href` link to FlockChat section
- [ ] P4-4: Remove `the_comms.js` import from `the_ark.js`
- [ ] P4-5: Add `[DEPRECATED]` notice to `app.flockchat/app.flockchat.html`
- [ ] P4-6: Create `sections/letters.css` with standard header block
- [ ] P4-7: Add section bar + section header to `flockchat-public/FlockChat.html`
- [ ] P4-8: BCP

### Phase 5 — Per-Section CSS (one section at a time)
- [ ] P5-1: `sections/shepherd.css` + section bar in `app.flockos.html` + safe-area
- [ ] P5-2: `sections/pulpit.css` + section bar in `app.feed/feed.html` + safe-area
- [ ] P5-3: `sections/cantors.css` + section bar in `app.stand/music_stand.html` + safe-area
- [ ] P5-4: `sections/stage.css` + section bar in `app.flockshow/app.flockshow.html` + safe-area
- [ ] P5-5: `sections/the_path.css` + section bar in `app.grow/app.grow.html` + safe-area
- [ ] P5-6: `sections/invitation.css` + section bar in `app.invite/app.invite.html` + safe-area
- [ ] P5-7: `sections/wellspring.css` + section bar in `app.wellspring/app.wellspring.html` + safe-area (see §C)
- [ ] P5-8: `sections/archive.css` + section bar in `app.flockdocs/app.flockdocs.html` + safe-area
- [ ] P5-9: `sections/bulletin.css` + section bar in `app.flockshamar/app.flockshamar.html` + safe-area
- [ ] P5-10: `sections/family_tree.css` + section bar in `app.melchizedek/app.melchizedek.html` + safe-area
- [ ] P5-11: `sections/mission_report.css` + section bar in `app.multiply/multiply.html` + safe-area
- [ ] P5-12: `sections/codex.css` + section bar in `app.flockcodex/app.flockcodex.html` + safe-area
- [ ] P5-13: BCP after each section (individual BCPs, not batched)

### Phase 8 — The Codex (As-Built Documentation Section)
- [ ] P8-1: Create `app.flockcodex/` folder and `app.flockcodex.html` — auth gate `pastor+`, section bar, `sections/codex.css`
- [ ] P8-2: Author **Overview** page from Vision & Architecture docs (docs 01, 03)
- [ ] P8-3: Author **Standards & Structure** page from Development Standards + File Structure docs (docs 02, 04, 07)
- [ ] P8-4: Author **Data Layer** page from Firestore Schema + Data Layer Inventory + Firestore Rules (docs 09, 10, 11, 19)
- [ ] P8-5: Author **Scripts & Views** page from Script Inventory + View Inventory + App Dependency Map (docs 05, 07, 08)
- [ ] P8-6: Author **Backend & Automation** page from GAS Backend + Automation Scripts + Shepherds Automation (docs 06, 14, 15)
- [ ] P8-7: Author **Build & Operations** page from Build & Ops Guide + Debugging Map (docs 12, 16)
- [ ] P8-8: Author **Church Setup & Branding** page from Branding Registry + New Church Setup + Seed Database (docs 17, 24, 25)
- [ ] P8-9: Author **Flows & Policy** page from Flow Policy + Pastor's Guide (docs 13, 23)
- [ ] P8-10: Author **Parity & Reference** page from NC→OC Parity Map + Subfolder Reference + Doc Index (docs 18, 20, 21, 22)
- [ ] P8-11: Add sidebar TOC navigation inside The Codex (links between the 9 pages)
- [ ] P8-12: Add print-friendly `@media print` styles in `sections/codex.css`
- [ ] P8-13: Create `app.embeds/embed-flockcodex.html` (per new-app rule)
- [ ] P8-14: BCP

### Phase 6 — ~~Refactor `new_covenant.css`~~ CANCELLED
> **This phase is cut.** Stripping per-app typography out of a 3,000-line monolith is pure risk with zero user benefit. The section CSS files are additive — they never replace anything already in `new_covenant.css`. `new_covenant.css` is treated as read-only for this entire project except for the three targeted Phase 0 additions (`--fn-scale`, `--safe-*`, `.sec-nav-bar`).

### Phase 7 — QA & Device Testing
- [ ] P7-1: Font-scale picker: all 5 steps on iOS Safari, Android Chrome, Desktop Chrome
- [ ] P7-2: All sections correct at Compact (0.85×) and XL (1.25×)
- [ ] P7-3: Section bar: test scroll on 375px (iPhone SE), 393px (iPhone 14 Pro), 360px (Samsung S24)
- [ ] P7-4: Dynamic Island safe area: test Herald masthead on iPhone 14 Pro / 15 Pro (393px, 59px top inset)
- [ ] P7-5: Home indicator overlap: test bottom bars on iPhone X/11/12/13/14 (34px bottom inset)
- [ ] P7-6: Samsung Galaxy notch/punch-hole: test top bar on S24 (approx 24px top inset)
- [ ] P7-7: Landscape orientation: section bar + masthead on all device profiles
- [ ] P7-8: Pillars sidebar inside FlockOS unaffected by section bar (no layout overlap)
- [ ] P7-9: All 47 registered views render without regression inside FlockOS
- [ ] P7-10: GROW views work in both `app.grow.html` (public) AND inside FlockOS (authenticated)
- [ ] P7-11: Wellspring — all offline functions work after section bar addition (no JS conflicts)
- [ ] P7-12: News Editor — auth redirects to login if no session, loads clean if pastor+
- [ ] P7-13: Admin page — inaccessible to member/volunteer/leader; loads clean for pastor/admin
- [ ] P7-14: B-Build clean. All nations receive `sections/` folder. Spot-check two nations.
- [ ] P7-15: BCP (final)

---

## 1. The Core Metaphor

A great newspaper has:
- A **masthead** (identity, date, church name)
- A **front page** (today's most important content — the Herald)
- **Named sections** (Sports → Worship, Business → Shepherd's Desk, Editorial → FEED, etc.)
- **A letters column** (FlockChat — church messaging)
- **An editorial board room** (the News Editor + Admin page — staff only)
- A **consistent typeface** and **grid** that makes every page feel like the same paper

The user never "switches apps" — they flip sections. The nav is a section bar, not an app switcher. And the Editor controls what the front page says.

---

## 2. Two-Tier Navigation — Architecture

### Tier 1: Top-Level Sections (standalone HTML pages / PWAs)
Each is its own HTML file, manifest, and section CSS file. The **section bar** navigates between these.

| Section | HTML Entry Point | Newspaper Name | Min Role |
|---|---|---|---|
| Front Page | `app.flocknews/flocknews.html` | **The Flock Herald** | Public |
| The Shepherd's Desk | `app.flockos/app.flockos.html` | **The Shepherd's Desk** | `pastor` |
| The Pulpit | `app.feed/feed.html` | **The Pulpit** | `leader` |
| The Cantors' Corner | `app.stand/music_stand.html` | **The Cantors' Corner** | `leader` |
| The Stage | `app.flockshow/app.flockshow.html` | **The Stage** | `leader` |
| The Letters Column | `flockchat-public/FlockChat.html` | **The Letters Column** | `readonly` (member) |
| The Path | `app.grow/app.grow.html` | **The Path** | Public |
| The Invitation | `app.invite/app.invite.html` | **The Invitation** | Public |
| The Wellspring | `app.wellspring/app.wellspring.html` | **The Wellspring** | Public |
| The Archive | `app.flockdocs/app.flockdocs.html` | **The Archive** | `pastor` |
| The Bulletin Board | `app.flockshamar/app.flockshamar.html` | **The Bulletin Board** | `readonly` (member) |
| The Family Tree | `app.melchizedek/app.melchizedek.html` | **The Family Tree** | `readonly` (member) |
| The Mission Report | `app.multiply/multiply.html` | **The Mission Report** | `pastor` |
| **The Codex** | `app.flockcodex/app.flockcodex.html` *(new)* | **The Codex** | `pastor` |
| **The Editorial Board** | `app.flocknews/admin.html` *(new)* | **The Editorial Board** | `pastor` |
| *(staff tool)* | `app.flocknews/news_editor.html` | **The Editor's Desk** | `pastor` |

**Deprecated:** `app.flockchat/app.flockchat.html` — stale mirror. Marked deprecated; live app is `flockchat-public/FlockChat.html`.

### Tier 2: In-App Views (SPA views rendered inside The Shepherd's Desk)
`app.flockos.html` is an SPA. All 47 registered views load inside it via `the_scribes` router. The **Pillars sidebar** navigates between these. The section bar handles Tier 1 only.

Views are organized under Pillars section headings (editorial sub-section heads within The Shepherd's Desk):

| Pillars Section | Views |
|---|---|
| **Home** | `the_good_shepherd` |
| **Word** | `the_upper_room`, `the_growth` |
| **Comms** | `the_fellowship`, `the_announcements`, `the_prayer_chain` |
| **Care** | `the_fold`, `the_life`, `the_call_to_forgive`, `prayerful_action`, `the_seasons` |
| **Worship** | `the_anatomy_of_worship`, `quarterly_worship`, `the_pentecost`, *(link)* FlockStand, *(link)* FEED, *(link)* FlockShow |
| **Mission** | `the_great_commission`, `the_gospel_invitation`, `the_harvest`, `the_way`, `the_truth`, `fishing_for_men`, `fishing_for_data` |
| **Discipleship** | `the_growth`, `the_gospel_courses`, `the_gospel_quizzes`, `the_gospel_reading`, `the_gospel_theology`, `the_gospel_teaching_plans`, `the_gospel_lexicon`, `the_gospel_library`, `the_gospel_devotionals`, `the_gospel_apologetics`, `the_gospel_counseling`, `the_gospel_heart`, `the_gospel_mirror`, `the_gospel_genealogy`, `the_gospel_journal`, `the_gospel_certificates`, `the_gospel_analytics` |
| **Stewardship** | `the_gift_drift`, `the_weavers_plan` |
| **Legacy** | `the_generations` |
| **Build (Admin)** | `the_wall`, `bezalel`, `content-admin`, `the_invitation`, `software_deployment_referral`, `learn_more`, `about_flockos` |

> **Note on Discipleship duplication:** The `the_gospel_*` views appear inside FlockOS (with member context/progress tracking) AND in `app.grow.html` (public, no-auth). This is intentional. The public GROW app is the outreach tool; the FlockOS views are the pastoral/discipleship tracking tool.

---

## § A — The News Editor (Enhanced)

### What Exists Today
`app.flocknews/news_editor.html` — A dark-sidebar control panel that lets a user toggle sections, pick content indices, and preview the Herald in an iframe. Has accordion sections for: Devotional, Heart Check, Missions, Theology, Apologetics. Loads `news_editor.css`. **No auth gate.** Anyone with the URL can access it.

### Required Changes

**1. Auth Gate (pastor+ required)**
Add `Nehemiah.guard()` at the top of the page before anything renders. If the user is not authenticated or is below `pastor` level, redirect to the Herald login. The gate must check both GAS session and Firebase Auth so it works on both data backends.

```html
<!-- Add to news_editor.html BEFORE any render logic -->
<script src="../Scripts/firm_foundation.js"></script>
<script>
  (function() {
    // Theme + font scale restore
    try {
      var t = localStorage.getItem('flock_theme') || 'america';
      document.documentElement.setAttribute('data-theme', t);
      var s = parseFloat(localStorage.getItem('flock_font_scale') || '1');
      document.documentElement.style.setProperty('--fn-scale', s);
    } catch (_) {}
    // Auth gate — pastor+ required
    if (typeof Nehemiah !== 'undefined') {
      var sess = Nehemiah.guard();   // redirects if no session
      if (sess && !Nehemiah.hasRole('pastor')) {
        window.location.replace('../index.html');
      }
    }
  })();
</script>
```

**2. Auth Header Bar**
Add a slim header strip at the top of `news_editor.html` showing:
- "The Flock Herald — Editor's Desk"
- User's displayName + role badge (e.g., "Pastor Greg · pastor")
- Logout link

**3. iOS/Samsung Safe Area**
`news_editor.html` is accessed from iOS/Android. The sidebar header and the iframe viewport must both account for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.

**4. Section Coverage — Expand the Editor's Controls**
The current editor controls 5 sections. The target is full newspaper control:

| Section § | Editor Control | Type |
|---|---|---|
| §1 Devotional | Date override | Text input (auto by date) |
| §1b Scripture | Translation select | Dropdown |
| §1c Heart Check | Question index | Number input |
| §2 Missions Report | Country index (0–237) | Number input |
| §3 Theology Corner | Topic index (0–26) | Number input |
| §4 Apologetics | Topic index | Number input |
| §5 Discipleship | Module select | Dropdown |
| §6 Prayer Prompt | Date or custom text | Text input |
| §7 Announcements | Visibility toggle | Toggle |
| §8 Gospel Invitation | Style select | Dropdown |
| §9 Church Header | Date banner text | Text input |
| All Sections | Show/hide visibility | Toggle eye icon (existing) |
| All Sections | Reset to auto | Button |

**5. Save/Publish State**
The editor saves its configuration to `localStorage('flock_herald_config')`. The Herald reads this on load and applies overrides. Changes are not published until "Apply to Paper" is clicked. A "Reset All" button restores auto behavior.

---

## § B — Permission Map

### Role Levels (defined in `firm_foundation.js`)
```
readonly:  0  — authenticated member, view-only
volunteer: 1  — volunteers
care:      2  — care team / deacons
leader:    3  — ministry leaders, treasurers
pastor:    4  — pastor and above
admin:     5  — technical admin (full access)
```

### Tier 1 Section Access
| Section | Access Rule | Behavior if denied |
|---|---|---|
| The Flock Herald | Public (no auth) | Loads for everyone |
| The Path (GROW) | Public (no auth) | Loads for everyone |
| The Invitation | Public (no auth) | Loads for everyone |
| The Wellspring | Public (no auth) | Loads for everyone |
| The Letters Column | `readonly` (authenticated member) | Redirect to sign-in |
| The Bulletin Board | `readonly` (authenticated member) | Redirect to sign-in |
| The Family Tree | `readonly` (authenticated member) | Redirect to sign-in |
| The Pulpit | `leader` | Show soft "access denied" page |
| The Cantors' Corner | `leader` | Show soft "access denied" page |
| The Stage | `leader` | Show soft "access denied" page |
| The Shepherd's Desk | `pastor` | Redirect to sign-in |
| The Archive | `pastor` | Show soft "access denied" page |
| The Mission Report | `pastor` | Show soft "access denied" page |
| The Editorial Board | `pastor` | Redirect to sign-in |
| The Editor's Desk | `pastor` | Redirect to sign-in |

### Section Bar Visibility
The section bar renders all tabs by default. On auth resolution (`whoAmI()` completes):
- Tabs the user cannot access are **hidden** (not greyed — removed from DOM) on the client side
- Public tabs always visible
- Member tabs visible if `Nehemiah.isAuthenticated()`
- Leader+ tabs visible if `Nehemiah.hasRole('leader')`
- Pastor+ tabs visible if `Nehemiah.hasRole('pastor')`
- "The Editorial Board" and "The Editor's Desk" are never in the default section bar — they are accessed via a gear/settings icon in the Herald masthead, visible only to pastor+

### Tier 2 In-App View Access (inside FlockOS)
The Shepherd's Desk already requires `pastor` to access the app itself. Within it, individual view-level role enforcement is handled by the existing `Nehemiah.canAccess()` and `Nehemiah.requireRole()` calls in each view's `index.js`. This plan does not change individual view gates — it only ensures the Pillars sidebar hides items below the user's role level visually.

---

## § C — The Wellspring: No Functionality Lost

### What the Wellspring Does
`app.wellspring/app.wellspring.html` is a fully offline-capable tool. It lets churches with no internet run FlockOS entirely from local Excel files. It has:
- A dark navy + gold design (`--ws-navy-bg`, `--ws-gold`) — this is intentional and correct
- Its own inline `<style>` block with all its own CSS variables
- No dependency on `new_covenant.css` beyond the import line
- Offline file-import logic that must not be disturbed

### What Changes
Only cosmetic. The Wellspring is treated as an exception to the light/newsprint palette:
- The dark navy design stays exactly as-is
- `sections/wellspring.css` is a **thin file** that only adds:
  - The section bar (styled in the Wellspring's own dark palette — navy bar, gold chips)
  - The `--fn-scale`-based font-size root
  - `env(safe-area-inset-*)` padding on the top bar and bottom-most element
- No existing Wellspring CSS variables, layout, or logic are touched
- The section bar's background on the Wellspring page is `--ws-navy-bg` (matches) — it will not look like newsprint

### Wellspring Isolation Rule
> All changes to `app.wellspring.html` must be additive only. Do not remove, replace, or reorganize any existing CSS block, JS import, or HTML structure. Add the section bar before the existing first child of `<body>` and add the section CSS link after the existing stylesheet links.

---

## § E — Project Structure: `Newspaper/` as a Standalone Product

### Root Location
`/Users/greg.granger/Desktop/FlockOS/Software/Newspaper/`

This is a **brand-new product** — not a modification of New_Covenant. It lives as a sibling alongside New_Covenant. New_Covenant continues as the backend SPA platform; The Newspaper is the new editorial face of FlockOS. The Shepherd's Desk section inside the paper links into the existing New_Covenant FlockOS SPA rather than duplicating its 47 views.

---

### Naming Convention

**Folders** — named clearly so any pastor, developer, or church administrator understands the structure at a glance. Industry-standard where applicable.

**Files** — biblical names following and extending the New_Covenant lexicon. These names make the purpose unmistakable to those who know the system, while presenting an unfamiliar surface to anyone probing the codebase without context.

**UI display names** — always clear English newspaper section names (The Flock Herald, The Pulpit, etc.). The biblical file names are infrastructure; the display names are what pastors and members see.

---

### Complete Folder Structure

```
Newspaper/
  index.html                        ← The Flock Herald — front page of the paper
  manifest.json                     ← PWA manifest
  sw.js                             ← Service worker

  Scripts/
    the_living_water.js             ← Firebase config           [COPY: New_Covenant/the_living_water.js]
    firm_foundation.js              ← Nehemiah auth system       [COPY: New_Covenant/Scripts/firm_foundation.js]
    the_adornment.js                ← Theme + font scale engine  [COPY+ADAPT: New_Covenant/Scripts/the_adornment.js]
    the_gates.js                    ← Section nav bar            [NEW — Neh 3: gates organized city-section life]
    the_proclamation.js             ← Herald content engine      [NEW — Acts 2:14: heralds proclaim the word]
    the_standard.js                 ← Masthead component         [NEW — Isa 59:19: lift up a standard]
    the_cornerstone.js              ← Codex content pages        [NEW — Ps 118:22: cornerstone of knowledge]
    the_elders.js                   ← Editorial Board admin      [NEW — Acts 15: council of elders governed the church]
    the_cistern.js                  ← Client-side cache/storage  [COPY: New_Covenant/Scripts/the_cistern.js]
    the_witness.js                  ← Analytics / event logging  [COPY: New_Covenant/Scripts/the_witness.js]

    the_scribes/                    ← SPA router (Shepherd's Desk only)
      index.js                      [COPY: New_Covenant/Scripts/the_scribes/index.js]
      the_chronicle.js              [COPY: New_Covenant/Scripts/the_scribes/the_chronicle.js]
      the_path.js                   [COPY: New_Covenant/Scripts/the_scribes/the_path.js]

    the_priesthood/                 ← Auth token helpers
      index.js                      [COPY: New_Covenant/Scripts/the_priesthood/index.js]
      the_anointing.js              [COPY: New_Covenant/Scripts/the_priesthood/the_anointing.js]
      the_breastplate.js            [COPY: New_Covenant/Scripts/the_priesthood/the_breastplate.js]
      the_garments.js               [COPY: New_Covenant/Scripts/the_priesthood/the_garments.js]

  Styles/
    the_broadsheet.css              ← Newspaper design system    [NEW — replaces new_covenant.css for this product]
    sections/
      herald.css                    ← The Herald         — Altar Gold signature
      tabernacle.css                ← Shepherd's Desk    — Church Wine signature
      pulpit.css                    ← The Pulpit         — Bishop's Purple signature
      levites.css                   ← Cantors' Corner    — Cedar Green signature
      stage.css                     ← The Stage          — Vesper Blue signature (dark)
      epistles.css                  ← Letters Column     — Inkwell Blue signature
      straight_path.css             ← The Path           — Pilgrim Brown signature
      great_commission.css          ← The Invitation     — Altar Gold signature
      living_water.css              ← The Wellspring     — dark navy (additive only)
      scroll_room.css               ← The Archive        — Ink & Leather signature
      gatehouse.css                 ← Bulletin Board     — Crimson Notice signature
      genealogies.css               ← Family Tree        — Cedar & Stone signature
      harvest.css                   ← Mission Report     — Field Dispatch signature
      cornerstone.css               ← The Codex          — Blueprint Slate signature
      editors_desk.css              ← Editor's Desk      — Newsroom dark palette
      council.css                   ← Editorial Board    — Newsroom dark palette

  Sections/
    herald/                         ← Display: "The Flock Herald"  [front page]
      index.html
      manifest.json

    tabernacle/                     ← Display: "The Shepherd's Desk"  [pastor+ | embeds New_Covenant FlockOS SPA]
      index.html
      manifest.json

    pulpit/                         ← Display: "The Pulpit"  [leader+ | sermons / FEED]
      index.html
      manifest.json

    levites/                        ← Display: "The Cantors' Corner"  [leader+ | worship music / FlockStand]
      index.html
      manifest.json

    stage/                          ← Display: "The Stage"  [leader+ | FlockShow]
      index.html
      manifest.json

    epistles/                       ← Display: "The Letters Column"  [readonly+ | FlockChat]
      index.html
      manifest.json

    straight_path/                  ← Display: "The Path"  [public | GROW discipleship]
      index.html
      manifest.json

    great_commission/               ← Display: "The Invitation"  [public | outreach]
      index.html
      manifest.json

    living_water/                   ← Display: "The Wellspring"  [public | offline data engine]
      index.html
      manifest.json

    scroll_room/                    ← Display: "The Archive"  [pastor+ | FlockDocs]
      index.html
      manifest.json

    gatehouse/                      ← Display: "The Bulletin Board"  [readonly+ | FlockShamar]
      index.html
      manifest.json

    genealogies/                    ← Display: "The Family Tree"  [readonly+ | Melchizedek]
      index.html
      manifest.json

    harvest/                        ← Display: "The Mission Report"  [pastor+ | Multiply]
      index.html
      manifest.json

    cornerstone/                    ← Display: "The Codex"  [pastor+ | as-built documentation]
      index.html
      manifest.json

    editors_desk/                   ← Display: "The Editor's Desk"  [pastor+ | Herald controls]
      index.html
      manifest.json

    council/                        ← Display: "The Editorial Board"  [pastor+ | admin]
      index.html
      manifest.json

  Images/
  Data/
```

---

### Section Folder → Display Name → Biblical Rationale

| Folder | Display Name | Biblical Basis |
|---|---|---|
| `herald/` | The Flock Herald | Heralds proclaimed the king's word publicly |
| `tabernacle/` | The Shepherd's Desk | The tabernacle was where God met with the high priest — where the pastor works |
| `pulpit/` | The Pulpit | Neh 8:4 — Ezra stood on the wooden pulpit to proclaim the Word |
| `levites/` | The Cantors' Corner | 1 Chr 15 — the Levites led all worship music in the temple |
| `stage/` | The Stage | Clear projection/performance tool; no misdirection needed |
| `epistles/` | The Letters Column | The epistles are the letters of the church — Paul's correspondence |
| `straight_path/` | The Path | Matt 7:14 — "narrow is the way"; Prov 4:11 — "I guide you in the straight path" |
| `great_commission/` | The Invitation | Matt 28:19 — the Great Commission is the invitation to all |
| `living_water/` | The Wellspring | John 4:14 — "the water I give will become a spring of living water" |
| `scroll_room/` | The Archive | The scroll room = the ancient archive; Dead Sea Scrolls |
| `gatehouse/` | The Bulletin Board | Ruth 4:1, Neh 8:1 — the city gate was where public announcements were made |
| `genealogies/` | The Family Tree | Gen 5, 1 Chr 1–9 — the Bible's genealogy records |
| `harvest/` | The Mission Report | John 4:35 — "the fields are already ripe for harvest" |
| `cornerstone/` | The Codex | Ps 118:22 — the cornerstone = the foundational reference |
| `editors_desk/` | The Editor's Desk | Clear staff-tool name; no obfuscation needed at this level |
| `council/` | The Editorial Board | Acts 15 — the council of elders governed the church |

---

### New Script Files — Biblical Name Rationale

| File | Role | Biblical Basis |
|---|---|---|
| `the_gates.js` | Section navigation bar | Neh 3 — Nehemiah rebuilt the city gates; each gate organized a section of community life. The nav bar is the gates between sections. |
| `the_proclamation.js` | Herald content engine | Acts 2:14 — "Peter stood up and proclaimed." The herald's engine proclaims the day's content. |
| `the_standard.js` | Masthead component | Isa 59:19 — "When the enemy comes in like a flood, the Spirit of the Lord will lift up a standard." The masthead is the paper's standard/banner. |
| `the_cornerstone.js` | Codex content pages | Ps 118:22 / Eph 2:20 — Christ as the cornerstone of all things. The Codex is the foundational reference document. |
| `the_elders.js` | Editorial Board admin | Acts 15:6 — "The apostles and elders met to consider this question." The Editorial Board is the council of elders. |

---

### JS Files to Copy from New_Covenant

| Copy From | Copy To | Notes |
|---|---|---|
| `New_Covenant/the_living_water.js` | `Newspaper/Scripts/the_living_water.js` | Firebase config — adapt project IDs if needed |
| `New_Covenant/Scripts/firm_foundation.js` | `Newspaper/Scripts/firm_foundation.js` | Nehemiah auth — copy unchanged |
| `New_Covenant/Scripts/the_adornment.js` | `Newspaper/Scripts/the_adornment.js` | Theme + font scale — update any path refs |
| `New_Covenant/Scripts/the_cistern.js` | `Newspaper/Scripts/the_cistern.js` | Client storage — copy unchanged |
| `New_Covenant/Scripts/the_witness.js` | `Newspaper/Scripts/the_witness.js` | Analytics — copy unchanged |
| `New_Covenant/Scripts/the_scribes/` | `Newspaper/Scripts/the_scribes/` | Router — copy all 4 files unchanged |
| `New_Covenant/Scripts/the_priesthood/` | `Newspaper/Scripts/the_priesthood/` | Auth helpers — copy all 4 files unchanged |

---

### The Shepherd's Desk — Embed, Not Duplicate

The FlockOS SPA (47 registered views, deep Firestore) lives in New_Covenant and is not recreated inside Newspaper. `Sections/tabernacle/index.html` is a **thin authenticated shell** that:
1. Runs `firm_foundation.js` → redirects to login if below `pastor`
2. Renders the section bar at the top
3. Loads the New_Covenant FlockOS SPA in an `<iframe>` (or full redirect, TBD)

This keeps the Newspaper lean and the FlockOS SPA maintained in one place.

---

### `the_broadsheet.css` — New Design System

`Newspaper/Styles/the_broadsheet.css` is the Newspaper's equivalent of `new_covenant.css`. It contains:
- All palette tokens from Section 5 (paper, ink, gold, section signatures)
- Reset + base typography
- The `.sec-nav-bar` / `.sec-nav-tab` component
- `--fn-scale` + responsive font-size
- `--safe-top/bottom/left/right` safe area variables
- Shared layout primitives (masthead, page wrapper, article column, pull-quote)
- **Does NOT** contain FlockOS-specific styles (Pillars sidebar, card-grid, badge system) — those remain in `new_covenant.css`

---

## § D — The Codex (As-Built Documentation Section)

### What It Is
A dedicated Tier 1 section of the paper that presents the FlockOS as-built architectural documentation as clean, readable, pastor-facing reference pages. Blueprint Slate signature. Dark, authoritative, reference-shelf aesthetic.

### Critical Constraints
- **`Architechtural Docs/` is gitignored and private.** Those markdown files are the source material — they are never committed, never deployed, never fetched by the app.
- **The Codex pages are authored HTML.** The content from the as-built docs is adapted and written directly into `app.flockcodex/` HTML/JS files. Those files ARE tracked in git and deployed via B-Build.
- **The MDs stay as MDs.** They are the human-readable reference and the writing source. The app pages are the newspaper-formatted presentation layer. They are separate things.
- **Pastor+ auth gate** (`Nehemiah.guard()` minimum role `pastor`). The section bar tab is hidden for anyone below `pastor`.

### Structure — 9 Authored Pages

| Page | Content drawn from | As-Built Docs |
|---|---|---|
| **Overview** | Vision, architecture | 01, 03 |
| **Standards & Structure** | Dev standards, file structure, script inventory | 02, 04, 07 |
| **Data Layer** | Firestore schema, data layer inventory, Firestore rules | 09, 10, 11, 19 |
| **Scripts & Views** | App dependency map, view inventory, script inventory | 05, 07, 08 |
| **Backend & Automation** | GAS backend, automation scripts, Shepherds automation | 06, 14, 15 |
| **Build & Operations** | Build & ops guide, debugging map | 12, 16 |
| **Church Setup & Branding** | Branding registry, new church setup guide, seed database | 17, 24, 25 |
| **Flows & Policy** | Flow policy, A Pastor's Guide | 13, 23 |
| **Parity & Reference** | Parity map, subfolder reference, doc index | 18, 20, 21, 22 |

### Layout
- **Left sidebar:** Table of contents — all 9 pages linked. Active page highlighted in Blueprint Slate.
- **Main content:** Full-width article column. Section headers use `--sec-heading-font` (Playfair Display). Body in `'IM Fell English'` on newsprint.
- **Print view:** `@media print` in `sections/codex.css` — clean white + black ink, hides nav and section bar. Suitable for printing reference pages.
- **No search required for initial build.** Add as Phase 8+ enhancement.

### What The Codex Is NOT
- Not a markdown renderer — the content is authored HTML, not a live document viewer
- Not connected to Firebase Storage — no fetching, no upload scripts
- Not a replacement for `Architechtural Docs/` — the MDs remain the private source of truth
- Not auto-generated at build time — human-authored, updated manually when the as-built docs change

---

## 3. The Front Page — What Changes & What Stays

The main `New_Covenant/index.html` is a full-screen iframe of `app.flocknews/flocknews.html`. **This stays.** The Herald is the correct front page.

### Changes to the Front Page
1. **Section Bar replaces App Switcher** — The "Select an App" dropdown becomes a horizontal section strip below the masthead. Each chip is a Tier 1 section. Mobile: horizontally scrollable. Desktop: full row, overflow to "More ▾" dropdown.
2. **Masthead breadcrumb** — When inside any non-Herald Tier 1 page, the section header displays `The Flock Herald · [Section Name]` as an editorial byline.
3. **Light by default** — Herald and all sections are newsprint (cream + dark ink) by default. The Stage and The Wellspring are the only justified dark exceptions.

---

## 4. iOS / Samsung Safe Area — Implementation Standard

Every single HTML page in this project must implement safe area support. This is not optional. Devices affected:

| Device | Inset | Value (approx) |
|---|---|---|
| iPhone X / XS / 11 Pro / 12 Mini | Top notch | 44px (`env(safe-area-inset-top)`) |
| iPhone 12 / 13 / 14 | Top notch | 47px |
| iPhone 14 Pro / 15 Pro / 15 Pro Max | Dynamic Island | 59px |
| iPhone SE (3rd gen) | None (home button) | 0px — `env()` falls back to 0 |
| All Face ID iPhones | Home indicator | 34px (`env(safe-area-inset-bottom)`) |
| Samsung Galaxy S24 / S24+ | Punch-hole camera | ~24px |
| Samsung Galaxy S24 Ultra | Punch-hole camera | ~24px |
| Samsung Galaxy Fold (outer screen) | Various | ~30px |

### Required `<meta>` tag (already in most pages)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
```
`viewport-fit=cover` is the key — without it, `env(safe-area-inset-*)` returns 0.

### CSS Pattern — apply to every section header, every masthead, every bottom bar
```css
/* In new_covenant.css — added to :root */
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}

/* Section bar — sits below masthead, above content */
.sec-nav-bar {
  /* existing layout styles */
  padding-left:  max(12px, var(--safe-left));
  padding-right: max(12px, var(--safe-right));
}

/* Page masthead (Herald, section headers) */
.fn-back-bar,
.sec-header {
  padding-top: max(8px, var(--safe-top));
}

/* Any fixed/sticky bottom element */
.sec-bottom-bar,
.fn-footer {
  padding-bottom: max(16px, var(--safe-bottom));
}
```

### Wellspring Exception
The Wellspring's top bar already uses `padding: max(8px, env(safe-area-inset-top, 8px))` in some places. Verify this covers the Dynamic Island before considering it done.

### Herald iframe (the main `index.html`)
The outer `index.html` uses a full-screen iframe. The iframe's `flocknews.html` must apply safe area insets itself — the outer shell does not pass them through. This is already the correct behavior since each page handles its own safe area.

---

## 5. Color Palette — "The Broadsheet"

**Concept:** The warmth of old Bible paper. Iron gall ink. Altar gold catching the light. The feeling of reading something that matters.

---

### Mode 1 — The Paper (newsprint — default for all sections)

```css
/* ── Paper surfaces ─────────────────────────────────────────── */
--paper:          #faf6ed;   /* Old Ivory — light, airy newsprint (slightly lighter than cream today) */
--paper-white:    #fefcf7;   /* Cream letter paper — lifted surfaces, cards */
--paper-tint:     #ede8d8;   /* Aged parchment — column fills, sunken areas */
--paper-dark:     #ddd4be;   /* Deep parchment — column rule fills, borders */

/* ── Ink ────────────────────────────────────────────────────── */
--ink:            #1a100a;   /* Iron gall — near-black with a warm brown undertone */
--ink-mid:        #3a2510;   /* Deep sepia — subheads, secondary headlines */
--ink-dim:        #6a5038;   /* Faded ink — bylines, labels, small-caps metadata */
--ink-faint:      #9a8060;   /* Ghost ink — timestamps, tertiary metadata */

/* ── Gold ───────────────────────────────────────────────────── */
--gold:           #a07818;   /* Altar gold — rich, dark, dignified */
--gold-bright:    #c89420;   /* Bright gold — hover, active, interactive states */
--gold-pale:      #e8cc80;   /* Pale gold — disabled states, very subtle fills */

/* ── Rules (column dividers, borders) ─────────────────────── */
--rule:           #3a2510;   /* Sepia rule — hard column dividers (not harsh black) */
--rule-soft:      #c4b090;   /* Soft rule — section separators */
--rule-faint:     #ddd0b8;   /* Ghost rule — visual structure, barely visible */

/* ── Accent ─────────────────────────────────────────────────── */
--burgundy:       #5c1928;   /* Church wine — callout boxes, special notices */
--navy:           #0c1445;   /* Vesper blue — back button badge (already existing) */
```

**Typography:**
- Masthead: `'Pirata One'`
- Section headlines: `'Playfair Display'`
- Body text: `'IM Fell English'`
- Labels / bylines: `'Playfair Display'` in small-caps

---

### Mode 2 — The Newsroom (Editor's Desk + Editorial Board)

Dark. A lamp-lit editorial room late at night. Not flat black — warm charcoal with brown underneath.

```css
--ed-bg:          #120f08;   /* Printer's black — warmer than pure black */
--ed-panel:       #1c1710;   /* Elevated panel surface */
--ed-panel-2:     #252018;   /* Section sub-headers within sidebar */
--ed-rule:        #2e2a1c;   /* Panel dividers */
--ed-rule-hi:     #4a4432;   /* Highlighted rule lines */
--ed-gold:        #c9960a;   /* Editorial gold — punchy on dark */
--ed-gold-hi:     #e2ab18;   /* Hover state gold */
--ed-text:        #e8ddc8;   /* Warm off-white body text */
--ed-text-dim:    #8a7858;   /* Muted — dimmed text, placeholders */
--ed-ink:         #faf6ed;   /* Brightest text (matches --paper) */
```

The newsprint preview iframe inside the Editor's Desk renders Mode 1 (the Herald). The two palettes coexist in one viewport.

---

### Mode 3 — The Wellspring (exception — unchanged)

Already correct. Additive-only rule applies. These vars live in the HTML file's inline `<style>` and are never touched:

```css
--ws-navy-bg: #09102e;   /* Deep navy */
--ws-gold:    #e8a838;   /* Wellspring gold */
```

---

### Section Identity — The Illuminated Manuscript Principle

Each section has one **signature color** — a deep jewel tone. It appears in exactly two places:
1. The active state of the section bar chip (background of the active tab)
2. A 4px top accent stripe on the section's own masthead

Everywhere else, every section shares the same paper/ink palette. Color is rare, so it lands.

| Section | Signature Name | Hex |
|---|---|---|
| **The Herald** | Altar Gold | `#a07818` |
| **Shepherd's Desk** | Church Wine | `#5c1928` |
| **The Pulpit** | Bishop's Purple | `#2e1a4a` |
| **Cantors' Corner** | Cedar Green | `#1a3d28` |
| **The Stage** | Vesper Blue | `#0c1445` |
| **The Letters Column** | Inkwell Blue | `#1e3050` |
| **The Path** | Pilgrim Brown | `#4a2808` |
| **The Invitation** | Altar Gold | `#a07818` (outreach = Herald's gold) |
| **The Archive** | Ink & Leather | `#2a1a0e` |
| **The Bulletin Board** | Crimson Notice | `#3d1818` |
| **The Family Tree** | Cedar & Stone | `#1a3030` |
| **The Mission Report** | Field Dispatch | `#0e2818` |
| **The Codex** | Blueprint Slate | `#1a2a3a` |
| **The Editorial Board** | Newsroom Charcoal | `#120f08` |

The single thread across all three modes: **gold is always gold.** `#a07818` in newsprint, `#c9960a` in the newsroom, `#e8a838` in the Wellspring.

---

### Section Bar — Color Logic by Mode

| Context | Bar background | Active chip bg | Active chip text | Inactive chip text |
|---|---|---|---|---|
| Newsprint pages | `--paper-tint` `#ede8d8` | Section signature color | `#faf6ed` | `--ink-dim` `#6a5038` |
| Newsroom pages | `--ed-panel` `#1c1710` | `--ed-gold` `#c9960a` | `#120f08` | `--ed-text-dim` `#8a7858` |
| Wellspring | `#0c1445` | `#e8a838` | `#09102e` | `rgba(232,204,128,0.6)` |

---

## 6. Responsive Fonts — Device Font Selection

### The Mechanism
A `--fn-scale` CSS custom property multiplies the root `font-size`. All font sizes are in `rem`. Scaling the root cascades everywhere.

```css
/* new_covenant.css :root */
--fn-scale: 1;

html { font-size: calc(var(--fn-scale) * 100%); }
```

### Font Scale Picker — 5 Steps

| Step | Label | `--fn-scale` |
|---|---|---|
| 1 | Compact | 0.85 |
| 2 | Normal | 1.0 (default) |
| 3 | Comfortable | 1.1 |
| 4 | Large | 1.15 |
| 5 | XL | 1.25 |

Saves to `localStorage('flock_font_scale')`. Lives in `Scripts/the_adornment.js` as `Adornment.initFontScale()`.

### Boot Restore Pattern
All flash-prevention `<script>` blocks should follow this single pattern:
```js
(function() {
  try {
    var t = localStorage.getItem('flock_theme') || 'america';
    document.documentElement.setAttribute('data-theme', t);
    var s = parseFloat(localStorage.getItem('flock_font_scale') || '1');
    document.documentElement.style.setProperty('--fn-scale', s);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'america');
  }
})();
```

---

## 6. Per-Section CSS Architecture

### The Rule (prevents nightmares)
> A `sections/*.css` file may **only** define CSS that does not already exist in `new_covenant.css` or `flocknews.css`. If a rule already exists upstream, the section file does not touch it. If a different value is needed for a specific section, the section file uses a `--sec-*` scoped variable — never a direct override of an existing token.

### What `new_covenant.css` gets (Phase 0 additions only — three targeted additions, nothing removed)
```css
/* 1 — Font scale multiplier */
:root { --fn-scale: 1; }
html  { font-size: calc(var(--fn-scale) * 100%); }

/* 2 — iOS/Samsung safe area insets */
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}

/* 3 — Section navigation bar component */
.sec-nav-bar { ... }  /* horizontal chip strip */
.sec-nav-tab { ... }  /* individual chip */
.sec-nav-tab[aria-current="page"] { ... }  /* active state */
```
`new_covenant.css` is **read-only** for every other change in this project.

### What each section CSS file contains

Each `sections/{name}.css` is **small and additive**. Realistic expected sizes:

| Section CSS | Contents | Est. lines |
|---|---|---|
| `herald.css` | `flocknews.css` already handles Herald. This file: `rem` conversion delta + `--fn-scale` note. | ~30 |
| `editor.css` | Dark newsroom section bar palette. Auth header strip. `--ed-*` scoped vars. | ~60 |
| `admin_board.css` | Editorial Board page layout. Panel cards. | ~80 |
| `shepherd.css` | `--sec-heading-font` for Pillars sub-head labels. Section bar override (no special palette). | ~30 |
| `pulpit.css` | Sermon card editorial columns. Pull-quote style. | ~60 |
| `cantors.css` | Functional tool — barely anything. Section bar header only. | ~20 |
| `stage.css` | Dark section bar palette to match existing Stage dark theme. | ~40 |
| `letters.css` | Thin newsprint shell around FlockChat. Section bar header. | ~40 |
| `the_path.css` | Discipleship "series" editorial layout. | ~50 |
| `invitation.css` | Already beautiful — section bar header only. | ~20 |
| `wellspring.css` | Dark-palette section bar only. Additive. Nothing else. | ~50 |
| `archive.css` | Archive document card columns. | ~50 |
| `bulletin.css` | Editorial bulletin board cards. | ~40 |
| `family_tree.css` | Genealogy record layout. | ~40 |
| `mission_report.css` | Field report card style. | ~40 |

**Most sections will be 20–60 lines.** They are extensions — not replacements.

### Each file MUST follow this rule
```
✅ --sec-heading-font: 'Playfair Display', serif;   /* NEW token, scoped to section */
✅ .fn-section-header { padding-top: ... }           /* NEW component, does not exist in new_covenant.css */
❌ --ink: #2c2c2c;                                   /* Already in new_covenant.css — FORBIDDEN */
❌ h1 { font-size: 2rem; }                           /* Already in new_covenant.css — FORBIDDEN */
❌ :root { --bg: ... }                               /* Already in new_covenant.css — FORBIDDEN */
```

### Target File Structure
```
New_Covenant/
  Styles/
    new_covenant.css              ← FOUNDATION — tokens, reset, shell, card-grid,
                                     badges, modals, utilities, FlockChat bubbles.
                                     Only 3 additions made here (fn-scale, safe-area, sec-nav-bar).
                                     Everything else is untouched.

    sections/
      _README.md                  ← This rule set in writing
      herald.css                  ← The Flock Herald  — rem delta + fn-scale note
      editor.css                  ← The Editor's Desk — dark newsroom bar
      admin_board.css             ← The Editorial Board — admin panels
      shepherd.css                ← The Shepherd's Desk — Pillars heading font
      pulpit.css                  ← The Pulpit — sermon columns
      cantors.css                 ← The Cantors' Corner — minimal
      stage.css                   ← The Stage — dark section bar
      letters.css                 ← The Letters Column — newsprint shell
      the_path.css                ← The Path — discipleship series layout
      invitation.css              ← The Invitation — section bar header only
      wellspring.css              ← The Wellspring — dark section bar, additive only
      archive.css                 ← The Archive — document columns
      bulletin.css                ← The Bulletin Board — editorial cards
      family_tree.css             ← The Family Tree — genealogy records
      mission_report.css          ← The Mission Report — field dispatch cards
```

---

## 7. The Editorial Board (Admin Page — New)

### Purpose
`app.flocknews/admin.html` is a pastor+ only administration surface living inside the Herald's section. It is the newspaper's "back office." It consolidates the controls a pastor needs that span the whole paper.

### Sections of the Editorial Board

| Panel | Function | Data Source |
|---|---|---|
| **Edition Controls** | Show/hide Herald sections site-wide | `localStorage` / Firestore config |
| **Announcement Board** | Publish/edit church announcements | Firestore `announcements` collection |
| **Prayer Board** | Review and publish prayer requests | Firestore `prayer_chain` collection |
| **User Management** | View member list, assign roles up to leader | Firestore `users` (Nehemiah-gated: admin only for role assignment above pastor) |
| **Herald Analytics** | View open/read counts, share stats | Firestore analytics |
| **Section Visibility** | Show/hide Tier 1 sections from section bar per-church | Church config in Firestore |
| **Content Calendar** | Upcoming Herald editions / scheduled content | `localStorage` + Firestore |

### Auth Rule
- `pastor` (level 4): Access to all panels except User Management role assignment
- `admin` (level 5): Full access including role assignment

### Navigation
The Editorial Board is NOT in the main section bar for regular users. It is accessed via:
1. A settings gear `⚙` icon in the Herald masthead — visible only when `Nehemiah.hasRole('pastor')` returns true
2. The existing "Editor" button in the Herald masthead (which currently links to `news_editor.html`) is expanded into a dropdown: "Editor's Desk" and "Editorial Board"

---

## 8. Section Navigation Bar — Full Spec

### Design
Persistent horizontal strip below each section's masthead/header.

```
[ ✦ Herald ]  [ Shepherd's Desk ]  [ The Pulpit ]  [ The Letters ]  [ The Path ]  [ ··· More ▾ ]
```

- **Mobile (<600px):** Horizontally scrollable chip strip. Icon + short name. No overflow menu needed — scroll reveals all.
- **Tablet (600–1024px):** Full section names. Scroll if they overflow.
- **Desktop (>1024px):** All sections visible. Items that don't fit fall into "More ▾" dropdown.

### Safe Area Application
```css
.sec-nav-bar {
  /* Prevents chips from disappearing behind notch in landscape */
  padding-left:  max(12px, var(--safe-left));
  padding-right: max(12px, var(--safe-right));
}
```

### Auth-Aware Rendering
Section bar renders after `whoAmI()` resolves:
```js
whoAmI().then(user => {
  // Render all public tabs immediately
  // Then add role-gated tabs based on user.role
  // Pastor+ get gear icon → Editorial Board + Editor's Desk
});
```

### Active State
Active section tab:
- 3px gold bottom border (`--gold`)
- Label in `var(--masthead-font)` italic
- Defined in `new_covenant.css` as `.sec-nav-tab[aria-current="page"]`

### The Pillars (inside FlockOS) — NOT replaced
The Pillars sidebar handles Tier 2 view navigation inside FlockOS. The section bar handles Tier 1. They coexist without conflict.

---

## 9. Lipstick Work Summary — Every Section

| Section CSS | App | Key Changes |
|---|---|---|
| `herald.css` | app.flocknews | Section bar. Font-scale picker. `px` → `rem`. Safe area on masthead + back-bar. Auth-aware section bar. |
| `editor.css` | news_editor.html | Auth gate (pastor+). Auth header. Safe area on sidebar header. Font-scale restore. |
| `admin_board.css` | admin.html (new) | Pastor+ only. Full admin panels. Dark sidebar like editor + light content area. Safe area. |
| `shepherd.css` | app.flockos | Section bar above app shell. Pillars section heads as editorial sub-heads. Safe area on topbar. |
| `pulpit.css` | app.feed | Sermon cards → editorial columns. Pull-quote styling. Section bar. Safe area. |
| `cantors.css` | app.stand | Functional tool — minimal. Section bar + header. Font tokens. Safe area. |
| `stage.css` | app.flockshow | Dark (projection justified). Section bar in dark palette. Safe area. |
| `letters.css` | flockchat-public | Newspaper shell wrapper. `--sec-body-font` = serif for readable threads. Section bar. Safe area. |
| `the_path.css` | app.grow | Discipleship as editorial "series." Section bar. Reading plans in column layout. Safe area. |
| `invitation.css` | app.invite | Already beautiful. Section bar. Font tokens. Safe area. |
| `wellspring.css` | app.wellspring | Additive only. Section bar in Wellspring dark palette. Safe area on existing top bar. Font scale. |
| `archive.css` | app.flockdocs | Archive-style document cards. Section bar. Safe area. |
| `bulletin.css` | app.flockshamar | Cork board editorial aesthetic. Section bar. Safe area. |
| `family_tree.css` | app.melchizedek | Genealogy as editorial family records. Section bar. Safe area. |
| `mission_report.css` | app.multiply | Field report styling. Mission dispatch aesthetic. Section bar. Safe area. |
| `codex.css` | app.flockcodex (new) | Blueprint Slate signature. Sidebar TOC. Reference typography. Print-friendly `@media print`. Auth gate (pastor+). Safe area. |

---

## 10. FlockOS Comms → The Letters Column

### Today's Situation
- `the_comms.js` embeds FlockChat inside FlockOS via an iframe/component. This is the specific thing being replaced.
- `the_fellowship`, `the_announcements`, `the_prayer_chain` are **separate views** — member management tools. They stay.
- `app.flockchat/app.flockchat.html` is a stale local mirror. Deprecated.
- `flockchat-public/FlockChat.html` is the live deployed app.

### The Change
1. The FlockChat embed in FlockOS (`the_comms.js`) becomes a direct Pillars link labeled "The Letters Column" → opens `flockchat-public/FlockChat.html` as a Tier 1 section.
2. `the_fellowship`, `the_announcements`, `the_prayer_chain` remain in FlockOS Comms Pillars group.
3. `Scripts/the_comms.js` retired after audit confirms all Firestore listeners are covered by `flockchat.js`.
4. `app.flockchat/app.flockchat.html` marked `[DEPRECATED]` — excluded from B-Build rsync.

---

## 11. Build & Deployment

- `New_Covenant/Styles/sections/` is source of truth for all section CSS files.
- B-Build must sync `sections/` to all nations — verify the existing Styles rsync glob includes subfolders.
- All app HTML uses `<base href="../">` — `href="Styles/sections/herald.css"` resolves from any `app.*/` subfolder.
- `flocknews.html` and `news_editor.html` are in `app.flocknews/` — confirm `../Styles/sections/` resolves correctly.
- `admin.html` (new) lives in `app.flocknews/` — same base path as above.
- Font-scale picker: `Adornment.initFontScale()` in `Scripts/the_adornment.js`.
- No new Firebase projects. No new GAS scripts. No Firestore schema changes.

---

## 12. CSS Token Cross-Reference (Quick Edit Guide)

| What to change | Where |
|---|---|
| Headline font — all sections | `new_covenant.css` → `--heading-font` |
| Body font — all sections | `new_covenant.css` → `--body-serif` or `--body-sans` |
| Headline font — one section | `Styles/sections/{name}.css` → `--sec-heading-font` |
| Body font — one section | `Styles/sections/{name}.css` → `--sec-body-font` |
| User text scale | `localStorage('flock_font_scale')` → `--fn-scale` on `<html>` |
| Paper/background globally | `new_covenant.css` → `--paper` |
| Gold accent globally | `new_covenant.css` → `--gold` |
| Safe area insets | `new_covenant.css` → `--safe-top/bottom/left/right` |
| Herald masthead font | `sections/herald.css` → `--masthead-font` |
| FlockChat bubble colors | `new_covenant.css` → FlockChat bubble token block |
| Section nav active state | `new_covenant.css` → `.sec-nav-tab[aria-current="page"]` |
| Pillars sidebar (in FlockOS) | `new_covenant.css` → `.veil-side` / `.pillars-*` |
| FlockOS Tier-2 view typography | `sections/shepherd.css` → inherits to all in-app views |
| Wellspring palette | `app.wellspring/app.wellspring.html` inline `<style>` → `--ws-*` vars |
| Editor's Desk palette | `sections/editor.css` → `--ed-*` vars |

---

## 13. Module Inventory — Complete Rollcall

**Standalone HTML apps (Tier 1) — 16 total:**
Herald, Editor's Desk (auth), Editorial Board (auth/new), **The Codex (auth/new)**, Shepherd's Desk, Pulpit, Cantors', Stage, Letters Column, The Path, Invitation, Wellspring, Archive, Bulletin Board, Family Tree, Mission Report.

**In-app SPA views (Tier 2 — inside FlockOS) — 47 routes:**
`the_good_shepherd`, `the_upper_room`, `the_growth`, `the_fellowship`, `the_announcements`, `the_prayer_chain`, `the_fold`, `the_life`, `the_call_to_forgive`, `prayerful_action`, `the_seasons`, `the_anatomy_of_worship`, `quarterly_worship`, `the_pentecost`, `the_great_commission`, `the_gospel_invitation`, `the_harvest`, `the_way`, `the_truth`, `fishing_for_men`, `fishing_for_data`, `the_gift_drift`, `the_weavers_plan`, `the_generations`, `the_wall`, `bezalel`, `content-admin`, `the_invitation`, `software_deployment_referral`, `learn_more`, `about_flockos`, `the_gospel_courses`, `the_gospel_quizzes`, `the_gospel_reading`, `the_gospel_theology`, `the_gospel_teaching_plans`, `the_gospel_lexicon`, `the_gospel_library`, `the_gospel_devotionals`, `the_gospel_apologetics`, `the_gospel_counseling`, `the_gospel_heart`, `the_gospel_mirror`, `the_gospel_genealogy`, `the_gospel_journal`, `the_gospel_certificates`, `the_gospel_analytics`.

**Intentional public/auth dual presence:**
`the_gospel_*` discipleship views — public (no auth) in `app.grow.html`, authenticated (with progress tracking) inside FlockOS.

**Deprecated (not built, not synced):**
`app.flockchat/app.flockchat.html`.

---

## 14. What This Is NOT

- ❌ Not a data migration
- ❌ Not a new Firebase project or Firestore schema change
- ❌ Not a new GAS backend
- ❌ Not an SPA rewrite — each Tier 1 section remains its own HTML page
- ❌ Not a PWA architecture change — each app keeps its own manifest
- ❌ Not dark mode (except The Stage and The Wellspring — both justified)
- ❌ Not a redesign of the Pillars sidebar — it stays as in-app navigation for Tier 2
- ❌ Not a removal of any existing functionality — everything the Wellspring does today, it does tomorrow

This is **lipstick and font work** on a system whose bones are already built, with a proper auth layer on the tools that need it, and safe area support so every phone looks intentional.

---

*Plan v3 — May 2026. To-do list at top of document. Mark tasks `[x]` as completed.*


---

## 1. The Core Metaphor

A great newspaper has:
- A **masthead** (identity, date, church name)
- A **front page** (today's most important content — the Herald)
- **Named sections** (Sports → Worship, Business → Shepherd's Desk, Editorial → FEED, etc.)
- **A letters column** (FlockChat — church messaging)
- **Classifieds / Community** (Invite, Multiply, Harvest)
- A **consistent typeface** and **grid** that makes every page feel like the same paper

The user never "switches apps" — they flip sections. The nav is a section bar, not an app switcher.

---

## 2. Two-Tier Navigation — Understanding the Architecture

This is a critical distinction before anything else is planned.

### Tier 1: Top-Level Sections (standalone HTML pages / PWAs)
Each is its own HTML file, its own manifest, its own CSS. The **section bar** navigates between these.

| Section | HTML Entry Point | Newspaper Name | Auth |
|---|---|---|---|
| Front Page | `app.flocknews/flocknews.html` | **The Flock Herald** | Public |
| The Shepherd's Desk | `app.flockos/app.flockos.html` | **The Shepherd's Desk** | Yes — Pastor/Admin |
| The Pulpit | `app.feed/feed.html` | **The Pulpit** | Optional |
| The Cantors' Corner | `app.stand/music_stand.html` | **The Cantors' Corner** | Yes — Worship |
| The Stage | `app.flockshow/app.flockshow.html` | **The Stage** | Yes — Worship |
| The Letters Column | `flockchat-public/FlockChat.html` | **The Letters Column** | Yes — Members |
| The Path | `app.grow/app.grow.html` | **The Path** | Public (no-auth tools) |
| The Invitation | `app.invite/app.invite.html` | **The Invitation** | Public |
| The Wellspring | `app.wellspring/app.wellspring.html` | **The Wellspring** | Public |
| The Archive | `app.flockdocs/app.flockdocs.html` | **The Archive** | Yes — Admin |
| The Bulletin Board | `app.flockshamar/app.flockshamar.html` | **The Bulletin Board** | Yes — Members |
| The Family Tree | `app.melchizedek/app.melchizedek.html` | **The Family Tree** | Yes — Members |
| The Mission Report | `app.multiply/multiply.html` | **The Mission Report** | Yes — Admin |

**Deprecated:** `app.flockchat/app.flockchat.html` — stale local mirror of FlockChat. Marked deprecated; live app is `flockchat-public/FlockChat.html`.

### Tier 2: In-App Views (SPA views rendered inside The Shepherd's Desk)
`app.flockos.html` is an SPA. All 47 registered views load inside it via `the_scribes` router. The **Pillars sidebar** (`the_veil/the_pillars.js`) navigates between these. The section bar does NOT replace the Pillars — it navigates between Tier 1 apps. The Pillars remains for Tier 2 views inside FlockOS.

These 47 views are organized into Pillars sections (which become editorial sub-sections within The Shepherd's Desk):

#### Home
| View Route | Label | Notes |
|---|---|---|
| `the_good_shepherd` | Home — The Dashboard | Flock feed, counts, next steps, daily call |

#### Word
| View Route | Label | Notes |
|---|---|---|
| `the_upper_room` | The Upper Room | Devotional space + FlockChat integration point |
| `the_growth` | Grow Hub | Discipleship dashboard (launches gospel/* views) |

#### Comms
| View Route | Label | Notes |
|---|---|---|
| `the_fellowship` | Fellowship | Member directory and connection |
| `the_announcements` | Announcements | Church announcements |
| `the_prayer_chain` | Prayer Chain | Prayer requests and chain |

#### Care
| View Route | Label | Notes |
|---|---|---|
| `the_fold` | The Fold | Member care, follow-up, at-risk flagging |
| `the_life` | Pastoral Care | Pastoral care tracker with open care badge |
| `the_call_to_forgive` | Reconciliation | Forgiveness and reconciliation module |
| `prayerful_action` | Prayer Journal | Personal/corporate prayer journal |
| `the_seasons` | Seasons | Liturgical calendar |

#### Worship
| View Route | Label | Notes |
|---|---|---|
| `the_anatomy_of_worship` | Service Order | Worship service planning |
| `quarterly_worship` | Worship Plan | Quarterly worship calendar |
| `the_pentecost` | Special Services | Events, revivals, special occasions |
| *(external link)* | FlockStand | Opens `app.stand/` in section |
| *(external link)* | Sermon Builder | Opens `app.feed/feed.html` in section |
| *(external link)* | FlockShow | Opens `app.flockshow/` in section |

#### Mission
| View Route | Label | Notes |
|---|---|---|
| `the_great_commission` | Missions | Mission board |
| `the_gospel_invitation` | The Invitation | Gospel page (also accessible public via Tier 1) |
| `the_harvest` | Harvest | Evangelism and conversion tracking |
| `the_way` | The Way | Discipleship pathways |
| `the_truth` | Content Library | Media and content library |
| `fishing_for_men` | Outreach | Outreach tools |
| `fishing_for_data` | Analytics | Gospel analytics |

#### Discipleship (GROW learning modules — also available in `app.grow`)
| View Route | Label | Notes |
|---|---|---|
| `the_gospel_courses` | Courses | Bible/discipleship courses |
| `the_gospel_quizzes` | Quizzes | Knowledge quizzes |
| `the_gospel_reading` | Reading Plans | Bible reading plans |
| `the_gospel_theology` | Theology | Theological articles |
| `the_gospel_teaching_plans` | Teaching Plans | Lesson planning |
| `the_gospel_lexicon` | Lexicon | Strong's-style biblical lexicon |
| `the_gospel_library` | The Word Library | Scripture and reference library |
| `the_gospel_devotionals` | Devotionals | Daily devotionals |
| `the_gospel_apologetics` | Apologetics | Apologetics content |
| `the_gospel_counseling` | Counseling | Biblical counseling resources |
| `the_gospel_heart` | Heart Check | Personal spiritual inventory |
| `the_gospel_mirror` | Shepherd's Mirror | Self-assessment for pastors |
| `the_gospel_genealogy` | Biblical Genealogy | Scripture genealogy explorer |
| `the_gospel_journal` | Journal | Personal spiritual journal |
| `the_gospel_certificates` | Certificates | Completion certificates |
| `the_gospel_analytics` | Learning Analytics | Discipleship progress metrics |

#### Stewardship
| View Route | Label | Notes |
|---|---|---|
| `the_gift_drift` | Giving | Stewardship and giving tracking |
| `the_weavers_plan` | The Weaver's Plan | Strategic planning |

#### Legacy
| View Route | Label | Notes |
|---|---|---|
| `the_generations` | The Generations | Church history and legacy |

#### Build (Admin)
| View Route | Label | Notes |
|---|---|---|
| `the_wall` | Admin | Admin panel |
| `bezalel` | Bezalel | Design codex |
| `content-admin` | Truth Editor | Content admin |
| `the_invitation` | Invitations | New member invitation management |
| `software_deployment_referral` | Deploy & Refer | Church software deployment referral |
| `learn_more` | Learn More | Marketing/info |
| `about_flockos` | The Why | About FlockOS |

**Note on duplication between Tier 1 and Tier 2:** The GROW learning modules (`the_gospel_*`) exist as views inside FlockOS AND as the content of `app.grow.html`. This is intentional — `app.grow` is the public, no-auth version. The views inside FlockOS carry member context (progress tracking, journal sync, etc.). No consolidation needed; they serve different roles.

---

## 3. The Front Page — What Changes & What Stays

The main `New_Covenant/index.html` is a full-screen iframe of `app.flocknews/flocknews.html`. **This stays.** The Herald is the correct front page.

### Changes to the Front Page
1. **Section Bar replaces App Switcher** — The current "Select an App" dropdown in `flocknews.html` becomes a horizontal section strip below the masthead. Each chip is a Tier 1 section name. Mobile: horizontally scrollable. Desktop: full row, overflow to "More" dropdown.
2. **Masthead date line** — When inside a sub-section (any non-Herald Tier 1 page), the section header displays `The Flock Herald · [Section Name]` as an editorial breadcrumb.
3. **No dark mode** — The Herald is newsprint (cream + ink). All sections inherit this palette unless there is a specific functional reason. The Stage (`app.flockshow`) is dark by necessity — it is a projection tool. Everything else stays light.

---

## 4. Responsive Fonts — Device Font Selection

Every person's device has a preferred reading size. FlockOS must honor it.

### The Mechanism

A `--fn-scale` CSS custom property multiplies the root `font-size`. All font sizes throughout the product are set in `rem` (never `px` for text), so scaling the root cascades everywhere automatically.

```css
/* new_covenant.css :root */
--fn-scale: 1;   /* default. Range: 0.85 (Compact) → 1.25 (XL) */

html {
  font-size: calc(var(--fn-scale) * 100%);
  /* 100% = browser/OS default font size. --fn-scale multiplies it. */
}
```

### Font Scale Picker

A small `Aa` button in the Herald masthead bar (and in each section's top bar) opens a 5-step control:

| Step | Label | `--fn-scale` value |
|---|---|---|
| 1 | Compact | 0.85 |
| 2 | Normal | 1.0 |
| 3 | Comfortable | 1.1 |
| 4 | Large | 1.15 |
| 5 | XL | 1.25 |

Selection saves to `localStorage('flock_font_scale')` and applies via `document.documentElement.style.setProperty('--fn-scale', val)`.

### Boot Restore Script

Added to the flash-prevention `<script>` block in **every** HTML file (alongside the existing theme restore):

```js
(function() {
  try {
    var t = localStorage.getItem('flock_theme') || 'america';
    document.documentElement.setAttribute('data-theme', t);
    var s = parseFloat(localStorage.getItem('flock_font_scale') || '1');
    document.documentElement.style.setProperty('--fn-scale', s);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'america');
  }
})();
```

### Implementation Home
The picker UI and `initFontScale()` logic live in `Scripts/the_adornment.js` — it is already the font and theme management module. One new export: `Adornment.initFontScale()`.

---

## 5. CSS Architecture — Per-Section Files

### The Problem Today
- `Styles/new_covenant.css` is a monolith (~3,000+ lines): design tokens, reset, app shell, every view's typography, FlockChat bubbles, modals, card grids — all in one file.
- `app.flocknews/flocknews.css` is standalone and clean. It is the model for how this should work everywhere.
- Every app HTML loads only `new_covenant.css` — zero per-app typography control. Changing a font anywhere risks everything.

### The Target Architecture

```
New_Covenant/
  Styles/
    new_covenant.css            ← SHARED FOUNDATION only
                                   Contents: CSS custom properties (tokens), reset,
                                   app shell (topbar, sidebar, .veil-side), card-grid,
                                   badges, modals, utilities, FlockChat bubble tokens.
                                   NO per-app typography. NO per-section color overrides.

    sections/                   ← NEW — one file per Tier 1 standalone app
      _README.md                ← Architecture guide (this document is the source)
      herald.css                ← The Flock Herald  (app.flocknews)
      shepherd.css              ← The Shepherd's Desk  (app.flockos)
      pulpit.css                ← The Pulpit  (app.feed)
      cantors.css               ← The Cantors' Corner  (app.stand)
      stage.css                 ← The Stage  (app.flockshow — dark justified)
      letters.css               ← The Letters Column  (flockchat-public)
      the_path.css              ← The Path  (app.grow)
      invitation.css            ← The Invitation  (app.invite)
      wellspring.css            ← The Wellspring  (app.wellspring)
      archive.css               ← The Archive  (app.flockdocs)
      bulletin.css              ← The Bulletin Board  (app.flockshamar)
      family_tree.css           ← The Family Tree  (app.melchizedek)
      mission_report.css        ← The Mission Report  (app.multiply)
```

**In-app views inside FlockOS** (Tier 2) do NOT get individual section CSS files. They render inside `app.flockos.html`'s shell and inherit `new_covenant.css` + `shepherd.css`. The Pillars sidebar sections (Word, Comms, Care, Worship, etc.) are expressed as editorial sub-section headers within `shepherd.css`.

### Section CSS File Header Convention

Every `sections/*.css` file MUST open with this header block:

```css
/* ═══════════════════════════════════════════════════════════════════════
   [SECTION NAME] — sections/[filename].css
   Newspaper Section: [The Newspaper Name]
   App: [app folder path]

   DEPENDS ON: ../new_covenant.css  (must be loaded FIRST in the HTML)

   FONT TOKENS (override these here, global tokens live in new_covenant.css):
     --sec-heading-font:  [font]   — section headlines
     --sec-body-font:     [font]   — body/article text
     --sec-label-font:    [font]   — bylines, metadata, labels

   SCALE: All sizes in rem. html font-size = calc(--fn-scale * 100%).
          --fn-scale is set by font picker, restored from localStorage on boot.

   CROSS-LINKS:
     Change headline font ALL sections  → new_covenant.css  → --heading-font
     Change headline font THIS section  → --sec-heading-font below
     Change body text scale (user)      → localStorage 'flock_font_scale' → --fn-scale
     Change paper/background globally   → new_covenant.css  → --paper
     Change gold accent globally        → new_covenant.css  → --gold
     Change section nav active state    → new_covenant.css  → .sec-nav-tab[aria-current]
   ═══════════════════════════════════════════════════════════════════════ */
```

---

## 6. FlockOS Comms → FlockChat (The Letters Column)

### Today's Situation
- `app.flockos.html` has a Comms embed powered by `Scripts/the_comms.js` — this is what embeds the FlockChat UI inside FlockOS.
- `the_fellowship`, `the_announcements`, `the_prayer_chain` are **separate views** inside the Pillars sidebar under "Comms." These are member-management tools. They are NOT the same as FlockChat. They stay.
- `app.flockchat/app.flockchat.html` is a stale local mirror of FlockChat. Not deployed. Deprecated.
- `flockchat-public/FlockChat.html` is the live, deployed FlockChat standalone app.

### The Change
1. The **FlockChat embed** in FlockOS (the_comms.js) becomes a direct Pillars item labeled "The Letters Column" that navigates to `flockchat-public/FlockChat.html` as a Tier 1 section (not an iframe embed).
2. `the_fellowship`, `the_announcements`, and `the_prayer_chain` views remain in FlockOS under the Comms Pillars group — they are congregation management tools, not messaging.
3. `Scripts/the_comms.js` is retired after: (a) auditing its Firestore listeners and verifying each is covered by `flockchat-public/flockchat.js`; (b) removing its registration from `the_ark.js` and its Pillars entry from `the_pillars.js`.
4. `app.flockchat/app.flockchat.html` is marked `[DEPRECATED — use flockchat-public/FlockChat.html]`. Folder is kept but excluded from builds.
5. `sections/letters.css` wraps FlockChat in the newspaper shell: masthead-style section header, section bar, `--sec-body-font: var(--body-serif)` for a readable message thread feel.

---

## 7. Section Navigation Bar

### Design
The section bar replaces the "Select an App" dropdown in every Tier 1 standalone HTML page. It is a persistent horizontal strip, positioned just below the section's own header/masthead.

```
[ ✦ Herald ] [ Shepherd's Desk ] [ The Pulpit ] [ The Letters ] [ The Path ] [ ··· More ]
```

- **Mobile (<600px):** horizontally scrollable row of icon + short name chips. No overflow menu.
- **Tablet (600–1024px):** full section names, scroll if they overflow.
- **Desktop (>1024px):** all sections visible. Items that don't fit fall into a "More ▾" dropdown.

### Active State
The active section tab:
- Gets a thick gold bottom border (`--gold`, 3px)
- Label is set in `var(--masthead-font)` italic
- Defined once in `new_covenant.css` as `.sec-nav-bar` / `.sec-nav-tab[aria-current="page"]`

### The Pillars (inside FlockOS) — NOT replaced
The Pillars sidebar inside `app.flockos.html` remains the navigation for Tier 2 in-app views. The section bar sits above the FlockOS shell and handles Tier 1 navigation. They are complementary, not redundant.

---

## 8. What "Lipstick" Means for Each Section

UI/presentation refactor only. No data schema changes. No new Firestore collections. No new Firebase projects. No new GAS scripts.

| Section CSS | App | Lipstick Work |
|---|---|---|
| `herald.css` | app.flocknews | Section bar replaces "Select an App" dropdown. Font-scale picker in masthead. All `px` font sizes → `rem`. |
| `shepherd.css` | app.flockos | Section bar above the app shell. Pillars section headers styled as editorial column heads. The Shepherd's Desk masthead header. |
| `pulpit.css` | app.feed | Sermon cards styled as editorial columns. Pull-quote styling. Section bar. |
| `cantors.css` | app.stand | Minimal — functional tool. Section bar + section header. Font tokens only. |
| `stage.css` | app.flockshow | Dark is correct here (projection). Section bar and header in dark theme. |
| `letters.css` | flockchat-public | Newspaper shell wrapper. Section bar. `--sec-body-font` = serif for message threads. |
| `the_path.css` | app.grow | Discipleship steps as editorial "series." Section bar. Devotionals/reading plans in column layout. |
| `invitation.css` | app.invite | Already beautiful. Section bar. Font tokens. |
| `wellspring.css` | app.wellspring | Offline mode. Thin file — font tokens and section header only. |
| `archive.css` | app.flockdocs | Archive-style document card layout. Section bar. |
| `bulletin.css` | app.flockshamar | Notes in a cork board editorial aesthetic. Section bar. |
| `family_tree.css` | app.melchizedek | Genealogy as editorial family records. Section bar. |
| `mission_report.css` | app.multiply | Field report styling. Mission dispatch aesthetic. Section bar. |

---

## 9. Build & Deployment Notes

- `New_Covenant/Styles/sections/` is the **source of truth** for all section CSS files.
- B-Build (`Iris/Bezalel/Scripts/B-Build_Nations.sh`) must sync `New_Covenant/Styles/sections/` to all nations. The existing rsync for `New_Covenant/Styles/` should automatically include the `sections/` subfolder — verify this in B-Build before Phase 0 closes.
- All app HTML files use `<base href="../">`, so `href="Styles/sections/herald.css"` resolves correctly from any `app.*/` subfolder.
- `flocknews.html` and `news_editor.html` are in `app.flocknews/` and use `<base href>` — verify they can resolve `../Styles/sections/herald.css` correctly before linking.
- The font-scale picker: `Adornment.initFontScale()` in `Scripts/the_adornment.js`. The HTML `Aa` button markup will be a shared partial — define it once in a comment/snippet in `the_adornment.js` and copy into each app HTML.

---

## 10. Phase Sequence

### Phase 0 — Foundation (do first, nothing else starts until complete)
- [ ] Create `New_Covenant/Styles/sections/` folder
- [ ] Create `Styles/sections/_README.md` — architecture overview linking to this plan
- [ ] Add `--fn-scale: 1` to `new_covenant.css` `:root`
- [ ] Update html base font-size in `new_covenant.css` to `calc(var(--fn-scale) * 100%)`
- [ ] Add font-scale restore to the flash-prevention boot script pattern (document in `the_adornment.js`)
- [ ] Implement `Adornment.initFontScale()` — picker UI + localStorage read/write
- [ ] Verify B-Build rsync includes `Styles/sections/` — add rsync line if missing

### Phase 1 — Herald & Section Bar
- [ ] Create `sections/herald.css` with full header block
- [ ] Extract Herald-specific typography from `flocknews.css` into `sections/herald.css`; `flocknews.css` becomes an import shim that loads the section file
- [ ] Build `.sec-nav-bar` / `.sec-nav-tab` component in `new_covenant.css`
- [ ] Replace the "Select an App" dropdown in `flocknews.html` with `.sec-nav-bar`
- [ ] Add font-scale `Aa` button to Herald masthead in `flocknews.html`
- [ ] Convert all `flocknews.css` text sizes from `px` → `rem`
- [ ] BCP

### Phase 2 — FlockOS Comms Absorption
- [ ] Audit `Scripts/the_comms.js` — document all Firestore listeners and writes
- [ ] Confirm each is covered by `flockchat-public/flockchat.js`
- [ ] Replace the_comms entry in `the_pillars.js` with a direct `href` link to FlockChat as Tier 1 section
- [ ] Remove `the_comms.js` import from `the_ark.js`
- [ ] Add `[DEPRECATED]` notice to `app.flockchat/app.flockchat.html`
- [ ] Create `sections/letters.css`
- [ ] BCP

### Phase 3 — Section CSS (one section at a time, in order)

**Order:** Herald (done in Phase 1) → FlockOS → GROW → FEED → FlockChat → FlockStand → FlockShow → Invite → Wellspring → FlockDocs → FlockShamar → Melchizedek → Multiply

For each section:
- [ ] Create `sections/{name}.css` with the standard header block
- [ ] Add section header markup to the app's HTML
- [ ] Add `.sec-nav-bar` section bar to the app's HTML
- [ ] Link `Styles/sections/{name}.css` after `Styles/new_covenant.css` in the HTML `<head>`
- [ ] Convert inline `px` text sizes → `rem` in the app's HTML `<style>` blocks
- [ ] Add font-scale boot restore to the app's flash-prevention script
- [ ] Add `Adornment.initFontScale()` call to the app's boot sequence
- [ ] BCP after each section

### Phase 4 — Refactor `new_covenant.css`
- [ ] Strip per-app typography rules now owned by section CSS files
- [ ] Strip per-app color overrides now owned by section CSS files
- [ ] Confirm remaining content is: tokens, reset, shell, card-grid, badges, modals, utilities, FlockChat bubble tokens
- [ ] Add a `/* ── TABLE OF CONTENTS ── */` comment block at the top listing every `--var` group

### Phase 5 — QA Pass
- [ ] Font-scale picker: test all 5 steps on iOS Safari, Android Chrome, Desktop Chrome
- [ ] All sections correct at Compact (0.85×) and XL (1.25×)
- [ ] Section bar scrolls correctly on 375px mobile viewport
- [ ] Pillars sidebar inside FlockOS unaffected by section bar (no layout conflict)
- [ ] All 47 registered views render without regression inside FlockOS
- [ ] No GROW views broken in either `app.grow.html` or inside FlockOS (both must work)
- [ ] B-Build clean. All nations receive `sections/` folder. Spot-check two nations.

---

## 11. CSS Token Cross-Reference (Quick Edit Guide)

> For any future developer or AI: when you need to change fonts or colors, use this table. Do not guess.

| What you want to change | Where |
|---|---|
| Headline font — all sections | `new_covenant.css` → `--heading-font` |
| Body font — all sections | `new_covenant.css` → `--body-serif` or `--body-sans` |
| Headline font — one section | `Styles/sections/{name}.css` → `--sec-heading-font` |
| Body font — one section | `Styles/sections/{name}.css` → `--sec-body-font` |
| User text scale | `localStorage('flock_font_scale')` → `--fn-scale` on `<html>` |
| Paper/background — global | `new_covenant.css` → `--paper` |
| Gold accent — global | `new_covenant.css` → `--gold` |
| Herald masthead typeface | `sections/herald.css` → `--masthead-font` |
| FlockChat bubble colors | `new_covenant.css` → FlockChat bubble token block |
| Section nav active state | `new_covenant.css` → `.sec-nav-tab[aria-current="page"]` |
| Pillars sidebar styles (in FlockOS) | `new_covenant.css` → `.veil-side` / `.pillars-*` |
| FlockOS Tier-2 view typography | `sections/shepherd.css` → inherits to all in-app views |

---

## 12. Module Inventory — No Redundancy Check

Every module, view, and standalone app in New_Covenant appears exactly once in this plan:

**Standalone HTML apps (Tier 1) — 16 sections:**
Herald, Editor's Desk (auth), Editorial Board (auth/new), The Codex (auth/new), Shepherd's Desk, Pulpit, Cantors', Stage, Letters Column, The Path, Invitation, Wellspring, Archive, Bulletin Board, Family Tree, Mission Report.

**In-app SPA views (Tier 2 — inside FlockOS) — 47 routes:**
`the_good_shepherd`, `the_upper_room`, `the_growth`, `the_fellowship`, `the_announcements`, `the_prayer_chain`, `the_fold`, `the_life`, `the_call_to_forgive`, `prayerful_action`, `the_seasons`, `the_anatomy_of_worship`, `quarterly_worship`, `the_pentecost`, `the_great_commission`, `the_gospel_invitation`, `the_harvest`, `the_way`, `the_truth`, `fishing_for_men`, `fishing_for_data`, `the_gift_drift`, `the_weavers_plan`, `the_generations`, `the_wall`, `bezalel`, `content-admin`, `the_invitation`, `software_deployment_referral`, `learn_more`, `about_flockos`, `the_gospel_courses`, `the_gospel_quizzes`, `the_gospel_reading`, `the_gospel_theology`, `the_gospel_teaching_plans`, `the_gospel_lexicon`, `the_gospel_library`, `the_gospel_devotionals`, `the_gospel_apologetics`, `the_gospel_counseling`, `the_gospel_heart`, `the_gospel_mirror`, `the_gospel_genealogy`, `the_gospel_journal`, `the_gospel_certificates`, `the_gospel_analytics`.

**Intentional overlap:** The `the_gospel_*` learning modules appear in BOTH `app.grow.html` (public, no-auth) AND inside FlockOS (member context, progress tracking). This is by design — not redundancy.

**Deprecated:** `app.flockchat/app.flockchat.html` (stale mirror — marked deprecated, not built).

---

## 13. What This Is NOT

- ❌ Not a data migration
- ❌ Not a new Firebase project or Firestore schema change
- ❌ Not a new GAS backend
- ❌ Not an SPA rewrite — each Tier 1 section remains its own HTML page
- ❌ Not a PWA architecture change — each app keeps its own manifest
- ❌ Not dark mode — Herald and all sections are light/newsprint by default; only The Stage is dark (projection requirement)
- ❌ Not a redesign of the Pillars sidebar — it stays as the in-app navigation for Tier 2 views inside FlockOS

This is exactly what it says: **lipstick and font work** on a system whose bones are already built. The data is there. The wiring is there. We are giving the building a beautiful facade and a consistent editorial design language.

---

*Plan authored: May 2026. Revised: accuracy pass — 47 registered views confirmed against `the_ark.js`, 16 Tier 1 sections, The Codex added, palette finalized. Start with Phase 0.*
