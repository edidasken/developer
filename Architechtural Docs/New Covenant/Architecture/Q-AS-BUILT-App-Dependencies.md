# Q-AS-BUILT-App-Dependencies.md
**FlockOS New Covenant — Complete App Dependency Reference**

---

## Overview

This document provides a comprehensive reference of **script loading order and dependencies** for all FlockOS New Covenant applications. Each app shell has a specific loading sequence designed to ensure Firebase SDKs, authentication, and core libraries initialize before app-specific logic runs.

**Key Patterns:**
- Firebase SDKs always load first (using `defer` attribute)
- FlockOS auth layer scripts (`firm_foundation`, `the_upper_room`, `the_true_vine`) load second
- App-specific modules load third
- Unity header/footer ES modules load last (mounted after DOM ready)
- Embed files use absolute URLs (`https://flock-os.github.io/FlockOS/New_Covenant/...`) to avoid base href conflicts

---

## 1. App Shell Dependencies

### 1.1 app.flockos (Main FlockOS Dashboard)

**Entry Point:** `app.flockos/app.flockos.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** Yes (full Nehemiah gate)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase initialization |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore database access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | User authentication |
| 4 | Firebase SDK | `firebase-functions-compat.js` | Cloud Functions calls |
| 5 | Firebase SDK | `firebase-messaging-compat.js` | Push notifications |
| 6 | Firebase SDK | `firebase-analytics-compat.js` | Google Analytics |
| 7 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah auth gate |
| 8 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper (window.UpperRoom) |
| 9 | FlockOS Core | `Scripts/fine_linen.js` | User profile manager |
| 10 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend adapter (window.TheVine) |
| 11 | FlockOS Core | `Scripts/the_wellspring.js` | Church profile system |
| 12 | FlockOS Core | `Scripts/the_well.js` | Utilities |
| 13 | FlockOS Core | `Scripts/the_tabernacle.js` | State management |
| 14 | FlockOS Core | `Scripts/the_truth.js` | Content rendering |
| 15 | FlockOS Core | `Scripts/the_seasons.js` | Calendar system |
| 16 | FlockOS Core | `Scripts/the_way.js` | Navigation |
| 17 | FlockOS Core | `Scripts/the_harvest.js` | Reporting |
| 18 | FlockOS Core | `Scripts/the_life.js` | Member management |
| 19 | FlockOS Core | `Scripts/the_shepherd.js` | Leadership tools |
| 20 | FlockOS Core | `Scripts/the_fold.js` | Group management |
| 21 | FlockOS Core | `Scripts/the_scrolls.js` | Document system |
| 22 | FlockOS Core | `Scripts/the_window_bridge.js` | Cross-window messaging |
| 23 | ES Module | `Scripts/the_ark.js` | Main app boot module |
| 24 | ES Module | `Scripts/the_unity_header.js` | Header component (imported by the_ark) |
| 25 | ES Module | `Scripts/the_unity_footer.js` | Footer component (imported by the_ark) |

**Firebase Config:** Injected inline as `window.FLOCK_FIREBASE_CONFIG` (patched per-church by B-Build)

---

### 1.2 app.feed (Sermon Archive)

**Entry Point:** `app.feed/feed.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** Yes (Nehemiah gate)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah auth gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | App Module | `app.feed/feed.js` | Sermon player logic |
| 8 | ES Module | `Scripts/the_unity_footer.js` | Footer component |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (patched per-church)  
**Firestore Collections:** `sermons`, `series`, `speakers`

---

### 1.3 app.flockchat (Team Messaging)

**Entry Point:** `app.flockchat/app.flockchat.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** Yes (Nehemiah gate)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | Firebase SDK | `firebase-messaging-compat.js` | Push notifications |
| 5 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah auth gate |
| 6 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 7 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 8 | App Module | `app.flockchat/flockchat.js` | Chat logic |
| 9 | ES Module | `Scripts/the_unity_header.js` | Header component |
| 10 | ES Module | `Scripts/the_unity_footer.js` | Footer component |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (patched per-church)  
**Firestore Collections:** `channels`, `channel_members`, `messages`, `user_profiles`

---

### 1.4 app.flockshow (Presentation Controller)

**Entry Point:** `app.flockshow/app.flockshow.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** Yes (Nehemiah gate)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah auth gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper + FlockStand song library |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | App Module | `app.flockshow/flockshow.js` | Presentation logic |
| 8 | ES Module | `Scripts/the_unity_footer.js` | Footer component |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (patched per-church)  
**Firestore Collections:** `presentations`, `slides`

---

### 1.5 app.stand (Music Stand / Chord Charts)

**Entry Point:** `app.stand/music_stand.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** Yes (Nehemiah gate)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah auth gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | Chord Engine | `Scripts/the_shofar/index.js` | ChordSheetJS library |
| 8 | ES Module | `Scripts/the_app_switcher.js` | App switcher UI |
| 9 | App Module | `app.stand/stand.js` | Music Stand logic |
| 10 | ES Module | `Scripts/the_unity_footer.js` | Footer component |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (inherited from parent or patched)  
**Firestore Collections:** `songs`, `setlists`

---

### 1.6 app.grow (Prayer & Outreach)

**Entry Point:** `app.grow/app.grow.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** No (public form)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v9.23.0) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | App Module | `app.grow/grow_public.js` | Prayer/outreach form logic |
| 4 | ES Module | `Scripts/the_unity_footer.js` | Footer component |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (patched per-church)  
**Firestore Collections:** `prayer_requests`, `outreach_submissions`  
**Note:** No authentication layer — public-facing forms

---

### 1.7 app.invite (Church Invitation Page)

**Entry Point:** `app.invite/app.invite.html`  
**Base Href:** `<base href="../">`  
**Auth Required:** No (public invitation)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access (for church map) |
| 3 | ES Module | `https://flock-os.github.io/FlockOS/New_Covenant/Scripts/the_gospel/the_gospel_invitation.js` | Invitation rendering |
| 4 | ES Module | `https://flock-os.github.io/FlockOS/New_Covenant/Scripts/the_unity_header.js` | Header component |
| 5 | ES Module | `https://flock-os.github.io/FlockOS/New_Covenant/Scripts/the_unity_footer.js` | Footer component |
| 6 | ES Module | `https://flock-os.github.io/FlockOS/New_Covenant/Scripts/the_living_water_register.js` | Service Worker registration |

**Firebase Config:** `window.FLOCK_FIREBASE_CONFIG` (patched per-church)  
**Firestore Collections:** `church_info` (read-only for map/contact)  
**Note:** No auth layer — public invitation, uses absolute URLs for all ES modules

---

### 1.8 app.embeds (Standalone Launcher)

**Entry Point:** `app.embeds/embed-launcher.html`  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`  
**Auth Required:** No (public launcher)

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | None | — | Pure HTML/CSS launcher (no scripts) |

**Firebase Config:** N/A  
**Note:** Static HTML launcher with church branding, no dependencies

---

## 2. Embed File Dependencies

All embed files use **absolute URLs** (`https://flock-os.github.io/FlockOS/New_Covenant/...`) to avoid base href conflicts when embedded in external sites.

### 2.1 embed-flockos.html

**Purpose:** Embeddable FlockOS dashboard  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | Firebase SDK | `firebase-functions-compat.js` | Cloud Functions |
| 5 | Firebase SDK | `firebase-messaging-compat.js` | Push notifications |
| 6 | Firebase SDK | `firebase-analytics-compat.js` | Analytics |
| 7 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah gate |
| 8 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 9 | FlockOS Core | `Scripts/fine_linen.js` | User profiles |
| 10 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 11 | FlockOS Core | `Scripts/the_wellspring.js` | Church profiles |
| 12 | FlockOS Core | `Scripts/the_well.js` | Utilities |
| 13 | FlockOS Core | `Scripts/the_tabernacle.js` | State management |
| 14 | FlockOS Core | `Scripts/the_truth.js` | Content rendering |
| 15 | FlockOS Core | `Scripts/the_seasons.js` | Calendar |
| 16 | FlockOS Core | `Scripts/the_way.js` | Navigation |
| 17 | FlockOS Core | `Scripts/the_harvest.js` | Reporting |
| 18 | FlockOS Core | `Scripts/the_life.js` | Members |
| 19 | FlockOS Core | `Scripts/the_shepherd.js` | Leadership |
| 20 | FlockOS Core | `Scripts/the_fold.js` | Groups |
| 21 | FlockOS Core | `Scripts/the_scrolls.js` | Documents |
| 22 | FlockOS Core | `Scripts/the_window_bridge.js` | Cross-window messaging |
| 23 | ES Module | `https://flock-os.github.io/.../Scripts/the_ark.js` | Main boot module |

---

### 2.2 embed-stand.html

**Purpose:** Embeddable Music Stand  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | Chord Engine | `Scripts/the_shofar/index.js` | ChordSheetJS |
| 8 | App Module | `https://flock-os.github.io/.../app.stand/stand.js` | Music Stand module |

---

### 2.3 embed-feed.html

**Purpose:** Embeddable Sermon Archive  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | App Module | `app.feed/feed.js` | Sermon player |

---

### 2.4 embed-flockchat.html

**Purpose:** Embeddable Team Chat  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | Firebase SDK | `firebase-messaging-compat.js` | Push notifications |
| 5 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah gate |
| 6 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase wrapper |
| 7 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 8 | App Module | `app.flockchat/flockchat.js` | Chat logic |

---

### 2.5 embed-flockshow.html

**Purpose:** Embeddable Presentation Controller  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v10.14.1) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | Firebase SDK | `firebase-auth-compat.js` | Authentication |
| 4 | FlockOS Auth | `Scripts/firm_foundation.js` | Nehemiah gate |
| 5 | FlockOS Core | `Scripts/the_upper_room.js` | Firebase + FlockStand songs |
| 6 | FlockOS Core | `Scripts/the_true_vine.js` | GAS backend |
| 7 | App Module | `app.flockshow/flockshow.js` | Presentation logic |

---

### 2.6 embed-grow.html

**Purpose:** Embeddable Prayer & Outreach Form  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | Firebase SDK | `firebase-app-compat.js` (v9.23.0) | Core Firebase |
| 2 | Firebase SDK | `firebase-firestore-compat.js` | Firestore access |
| 3 | App Module | `app.grow/grow_public.js` | Prayer/outreach logic |

**Note:** No authentication — public form

---

### 2.7 embed-about.html

**Purpose:** Embeddable "About FlockOS" Page  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | None | — | Pure HTML/CSS content (no scripts) |

**Note:** Static content page

---

### 2.8 embed-launcher.html

**Purpose:** Embeddable Church Launcher  
**Base Href:** `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">`

**Script Loading Order:**

| Order | Type | Script | Purpose |
|-------|------|--------|---------|
| 1 | None | — | Pure HTML/CSS launcher (no scripts) |

**Note:** Static HTML with church branding

---

## 3. Core Script Reference

### 3.1 FlockOS Auth Layer

| Script | Global | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `firm_foundation.js` | `window.FirmFoundation` | Nehemiah authentication gate | Firebase Auth SDK |
| `the_upper_room.js` | `window.UpperRoom` | Firebase wrapper + FlockStand song library | Firebase SDKs, firm_foundation |
| `the_true_vine.js` | `window.TheVine` | Google Apps Script backend adapter | firm_foundation, the_upper_room |

### 3.2 FlockOS Backend Modules

| Script | Global | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `fine_linen.js` | `window.FineLinen` | User profile manager | UpperRoom |
| `the_wellspring.js` | `window.Wellspring` | Church profile system | UpperRoom |
| `the_well.js` | `window.Well` | Utility functions | — |
| `the_tabernacle.js` | `window.Tabernacle` | State management | UpperRoom |
| `the_truth.js` | `window.Truth` | Content rendering engine | UpperRoom |
| `the_seasons.js` | `window.Seasons` | Calendar system | UpperRoom |
| `the_way.js` | `window.Way` | Navigation manager | UpperRoom |
| `the_harvest.js` | `window.Harvest` | Reporting system | UpperRoom |
| `the_life.js` | `window.Life` | Member management | UpperRoom |
| `the_shepherd.js` | `window.Shepherd` | Leadership tools | UpperRoom |
| `the_fold.js` | `window.Fold` | Group management | UpperRoom |
| `the_scrolls.js` | `window.Scrolls` | Document system | UpperRoom |
| `the_window_bridge.js` | `window.WindowBridge` | Cross-window messaging | — |

### 3.3 App-Specific Modules (ES Modules)

| Script | Purpose | Firestore Collections | Dependencies |
|--------|---------|----------------------|--------------|
| `app.feed/feed.js` | Sermon archive player | `sermons`, `series`, `speakers` | UpperRoom, TheVine |
| `app.flockchat/flockchat.js` | Team messaging | `channels`, `messages`, `user_profiles` | UpperRoom, Firebase Messaging |
| `app.flockshow/flockshow.js` | Presentation controller | `presentations`, `slides` | UpperRoom, FlockStand songs |
| `app.stand/stand.js` | Music Stand chord charts | `songs`, `setlists` | the_shofar, UpperRoom |
| `app.grow/grow_public.js` | Prayer/outreach forms | `prayer_requests`, `outreach_submissions` | Firebase only (no auth) |
| `Scripts/the_ark.js` | Main FlockOS boot | All collections | All FlockOS backend modules |

### 3.4 Unity Header/Footer (ES Modules)

| Script | Export | Purpose | Dependencies |
|--------|--------|---------|--------------|
| `Scripts/the_unity_header.js` | `mountUnityHeader()` | Unified topbar with auth | firm_foundation, fine_linen |
| `Scripts/the_unity_footer.js` | `mountUnityFooter()` | Unified footer with navigation | — |

### 3.5 Specialized Libraries

| Script | Global/Export | Purpose | Dependencies |
|--------|---------------|---------|--------------|
| `Scripts/the_shofar/index.js` | `window.ChordSheetJS` | ChordSheetJS library for chord parsing | — |
| `Scripts/the_gospel/the_gospel_invitation.js` | ES module exports | Church invitation rendering | Firebase Firestore |
| `Scripts/the_living_water_register.js` | `register()` | Service Worker registration helper | — |
| `Scripts/the_app_switcher.js` | ES module | App switcher UI component | — |

---

## 4. Firebase SDK Version Reference

| SDK | Version | Used By |
|-----|---------|---------|
| `firebase-app-compat.js` | 10.14.1 | All apps except GROW |
| `firebase-firestore-compat.js` | 10.14.1 | All apps except GROW |
| `firebase-auth-compat.js` | 10.14.1 | All apps except GROW/Invite |
| `firebase-functions-compat.js` | 10.14.1 | FlockOS, embed-flockos |
| `firebase-messaging-compat.js` | 10.14.1 | FlockOS, FlockChat, embeds |
| `firebase-analytics-compat.js` | 10.14.1 | FlockOS, embed-flockos |
| `firebase-app-compat.js` | 9.23.0 | GROW only |
| `firebase-firestore-compat.js` | 9.23.0 | GROW only |

**Note:** GROW uses older Firebase v9.23.0 for compatibility with its public form architecture.

---

## 5. Loading Patterns & Best Practices

### 5.1 Script Attribute Strategy

- **`defer`**: Used for all Firebase SDKs and FlockOS backend scripts (loads after HTML parsing, executes in order)
- **`type="module"`**: Used for ES modules (app-specific logic, Unity components)
- **No attribute**: Used for inline config scripts (`window.FLOCK_FIREBASE_CONFIG`)

### 5.2 Base Href Strategies

| Strategy | Used By | Purpose |
|----------|---------|---------|
| `<base href="../">` | App shells in `app.*/` | Resolve relative paths from app folders |
| `<base href="https://flock-os.github.io/FlockOS/New_Covenant/">` | Embed files | Absolute URLs for external embedding |
| No base href | Root `index.html` | Direct path resolution |

### 5.3 Firebase Config Injection

All apps receive church-specific Firebase configuration via inline script:

```javascript
window.FLOCK_FIREBASE_CONFIG = {
  apiKey:            '...',
  authDomain:        '...',
  projectId:         '...',
  storageBucket:     '...',
  messagingSenderId: '...',
  appId:             '...',
  measurementId:     '...'
};
```

**Build Process:** `B-Build_Nations.sh` patches this config per-church using `ChurchRegistry/*.json` files.

### 5.4 Authentication Gate

Apps requiring authentication use the **Nehemiah gate** pattern:

1. `firm_foundation.js` checks Firebase Auth state
2. If unauthenticated, redirects to root launcher
3. If authenticated, initializes `UpperRoom` and `TheVine`
4. App-specific logic waits for `window.UpperRoom.ready` event

**Public apps** (GROW, Invite, Launcher) skip this gate entirely.

---

## 6. Dependency Graph

```
Firebase SDKs
    ↓
firm_foundation.js (Auth Gate)
    ↓
the_upper_room.js (Firebase Wrapper)
    ↓
the_true_vine.js (GAS Backend)
    ↓
┌────────────────────────────────────────┐
│ FlockOS Backend Modules:               │
│ • fine_linen (profiles)                │
│ • the_wellspring (church)              │
│ • the_tabernacle (state)               │
│ • the_truth (content)                  │
│ • the_seasons (calendar)               │
│ • the_way (navigation)                 │
│ • the_harvest (reporting)              │
│ • the_life (members)                   │
│ • the_shepherd (leadership)            │
│ • the_fold (groups)                    │
│ • the_scrolls (documents)              │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ App-Specific Modules:                  │
│ • the_ark.js (FlockOS boot)            │
│ • feed.js (sermons)                    │
│ • flockchat.js (chat)                  │
│ • flockshow.js (presentations)         │
│ • stand.js (music)                     │
│ • grow_public.js (forms)               │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Unity Components:                      │
│ • the_unity_header.js                  │
│ • the_unity_footer.js                  │
└────────────────────────────────────────┘
```

---

## 7. Cross-References

- **Functional Dependencies:** See [G-AS-BUILT-Script-Module-Inventory.md](G-AS-BUILT-Script-Module-Inventory.md)
- **Data Dependencies:** See [I-AS-BUILT-Data-Schema.md](I-AS-BUILT-Data-Schema.md)
- **App Architecture:** See [F-AS-BUILT-Architecture-Overview.md](F-AS-BUILT-Architecture-Overview.md) Section 7
- **Build Process:** See [K-AS-BUILT-Operations-Guide.md](K-AS-BUILT-Operations-Guide.md) Section 5
- **Service Worker:** See [L-AS-BUILT-Progressive-Web-App-Implementation.md](L-AS-BUILT-Progressive-Web-App-Implementation.md)

---

## 8. Maintenance Notes

### 8.1 Adding New Dependencies

When adding a new script dependency to an app:

1. **Insert at correct position** in loading order (Firebase → Auth → Core → App → Unity)
2. **Update this document** with new script entry
3. **Update G-AS-BUILT-Script-Module-Inventory.md** with exports/imports
4. **Test loading order** with browser DevTools Network tab
5. **Verify no race conditions** with deferred scripts

### 8.2 Firebase SDK Upgrades

When upgrading Firebase SDK versions:

1. **Update all CDN URLs** in app HTML files
2. **Update version table** in Section 4 of this document
3. **Test authentication flow** across all apps
4. **Verify Firestore queries** still function
5. **Check service worker** compatibility

### 8.3 New App Creation

When creating a new `app.*` directory:

1. **Follow loading order pattern** from existing apps
2. **Create matching embed file** in `app.embeds/`
3. **Add B-Build patch step** for Firebase config
4. **Update this document** with new app section
5. **Update F-AS-BUILT** Section 7 with architecture details

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-14  
**Audit Pass:** Initial creation  
**Author:** FlockOS Architecture Team  
**Status:** ✅ Complete & Current
