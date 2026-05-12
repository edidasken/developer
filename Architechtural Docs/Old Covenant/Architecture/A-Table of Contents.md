
---

## Plan: FlockOS Complete Documentation Guide — Table of Contents

**TL;DR**: A 20-chapter guide covering vision, architecture, every module/feature, deployment, security, and operational continuity - structured so anyone could maintain, extend, or deploy FlockOS independently.

---

## Current Architecture File Index (Alphabetical)

Updated: 2026-04-22 after archive cleanup and prefix normalization.

- A-Plan for New Covenant.md
- A-Table of Contents.md
- AA-Project Support Pitch.md
- B-In Order to Send.md
- C-Self-Hosting Guide.md
- D-Deployment and Connection.md
- E-Bezalel Dependencies.md
- F-Sync Secrets.md
- G-Verified Endpoints.md
- H-End to End Plan.md
- I-Firestore Reduction.md
- J-Firestore Rules.md
- K-Flock Docs.md
- P-Master Cleanup FlockOS.md
- Q-The 150 Plan.md
- R-Permissions Plan.md
- S-FlockChat.md
- T-Permissions Audit.md
- U-Workflows.md
- V-Bezalel.html
- V-Covenant-v1.0-Release.md
- V-Covenant-v1.1-Release.md
- W-Timeline.md
- X-Action Items.md
- Y-Debugging Issues.md
- Z-Project Documents.md
- Z-Variance.md

Archived files moved to:
- Covenant/Storehouse/Backups/Architecture-Archive-2026-04-22/

---

# 📖 FlockOS: The Complete Guide

---

## Covenant As-Built v1.0 (April 2026)

This section summarizes the as-built state of the FlockOS repo and deployment pipeline as of the v1.0 release:

- **Single Source of Truth:** All canonical source files live under `/Covenant/Courts/TheTabernacle/` (FlockOS), `/Covenant/Courts/TheFellowship/` (FlockChat), and `/Covenant/Courts/TheUpperRoom/` (ATOG).
- **Launcher Redesign:** All church deployments now use a slim launcher UI, matching the root `/index.html` design, with a brand header, mission/architecture section, 3-card apps grid, and referral/footer.
- **CSS Consolidation:** All shared app-shell CSS is in `/Styles/american_garments.css`. All deployments reference this root stylesheet.
- **Build Pipeline:** The build script (`Covenant/Bezalel/Scripts/A-Build_Churches.sh`) reads JSON configs from `/Covenant/Scrolls/ChurchRegistry/` and outputs fully branded deployments to `/Covenant/Nations/<shortName>/`.
- **App Links:** All app launchers use correct, canonical paths (e.g., FlockChat: `../../Courts/TheFellowship/FlockChat.html?church=<shortName-lower>`, ATOG: `../../Courts/TheUpperRoom/ATOG.html`).
- **Root Deployments:** The canonical home for root HTML files is `/Covenant/Nations/Root/`.
- **Versioning:** v1.0 release notes and technical details are in `V-Covenant-v1.0-Release.md`.
- **No Direct Edits:** Never edit `/Covenant/Nations/*` output directly—always build from source.
- **Documentation:** All architecture, deployment, and process docs are being updated to reflect this as-built state.

See also: [V-Covenant-v1.0-Release.md](V-Covenant-v1.0-Release.md)

---

## Part I — The Why

**Chapter 1: Vision & Mission**
- 1.1 The Two Questions That Started Everything
- 1.2 Mission: Church Management for Every Church. Every Size. Every Budget.
- 1.3 Free as the Gospel — Why $0 Forever
- 1.4 Built for the Margins — The Pastor on a $120 Phone
- 1.5 The Name: Why "FlockOS"
- 1.6 The Biblical Naming Convention — A Design Philosophy

**Chapter 2: What Sets FlockOS Apart**
- 2.1 The Competitive Landscape (Planning Center, Breeze, ChurchTrac, Tithe.ly)
- 2.2 Eight Differentiators at a Glance
- 2.3 Zero-Cost Architecture on Free-Tier Infrastructure
- 2.4 Data Sovereignty — Every Church Owns Its Own Data
- 2.5 Offline-First — The Full Platform Without Internet
- 2.6 One Codebase, Unlimited Churches
- 2.7 By the Numbers: 100K Lines, 200 Tabs, 2,800 Functions, 1 Developer

---

## Part II — Architecture & Design

**Chapter 3: System Architecture Overview**
- 3.1 The Three-Layer Stack (Browser → GitHub Pages → Google Apps Script)
- 3.2 The Four Connection Types (A: GAS-Only, B: GAS+Firestore Backup, C: Firebase Primary, D: Full Bidirectional Sync)
- 3.3 The 200-Tab Google Sheet — Database Design as a Spreadsheet
- 3.4 The Four API Domains (Gospels): John/Flock, Luke/Extra, Matthew/App, Mark/Missions
- 3.5 Firebase Firestore — Real-Time Layer
- 3.6 Cloud Functions — The Sync Bridge
- 3.7 GitHub Pages — Static Hosting at Scale
- 3.8 PWA & Capacitor — Mobile Deployment Without an App Store

**Chapter 4: The Biblical Module Map**
- 4.1 Why Biblical Names? Design Intent and Navigation Aid
- 4.2 Complete Module Reference Table (21 Scripts → Functional Roles)
- 4.3 Core Infrastructure: Tabernacle, Fine Linen, Cornerstone, True Vine, Firm Foundation
- 4.4 People & Pastoral: Shepherd, Life, Scrolls, Fold
- 4.5 Ministry & Worship: Harvest, Shofar, Seasons
- 4.6 Communications & Learning: Upper Room, Way, Truth
- 4.7 Device & Data: Trumpet, Wellspring, Well, Commission, Living Water
- 4.8 Module Dependency Graph — Who Calls What
- 4.9 The Dormant Module: The Pagans (Google Drive sync, parked)

**Chapter 5: The Backend — Google Apps Script (Code.gs)**
- 5.1 Single-File Architecture — Why 28,000 Lines in One File
- 5.2 Entry Points: `doGet()` / `doPost()` → `expansionDoGet()` / `expansionDoPost()`
- 5.3 The Complete Action Surface — Every API Endpoint Documented
- 5.4 Public vs. Authenticated Routes
- 5.5 The Sheet Tab Schema — All 200 Tabs by Domain
- 5.6 `setupFlockOS()` — What Happens When You Press the Button
- 5.7 Lazy Tab Creation — CRM Tabs on First Write
- 5.8 `normalizeCareRow_()` and Data Validation
- 5.9 CacheService — Quota Management with 60-Second Access Control Cache
- 5.10 Automated Triggers: `careFollowUpReminder`, `dailyPastoralSummary`
- 5.11 Church-Specific Code Variants (1-FlockOS, 2-TBC, 3-TheForest)
- 5.12 The Bezalel Codex — Auto-Generated Code Snapshots

**Chapter 6: The Frontend — App Shell & Rendering**
- 6.1 index.html and `the_good_shepherd.html` — Dual Master Files (Why Both Must Update Together)
- 6.2 App Shell: Topbar, Sidebar, Content Area, Floating Action Buttons
- 6.3 The Tabernacle — Core Renderer (48+ Module UIs, View Caching, Adaptive Performance)
- 6.4 The Cornerstone — Architecture Registry (200 Tab Names, RBAC Levels, Routing)
- 6.5 CSS Architecture: Variables, Responsive Breakpoints, iOS-Safe Inputs
- 6.6 The `_fp` Form Pattern — How Every Editor Panel Is Built
- 6.7 Navigation: Sidebar Groups, URL Hash Routing, Deep Links

**Chapter 7: The Theme System — Fine Linen**
- 7.1 14 Themes at a Glance (4 Light, 4 Dark, 5 Flag, 1 Auto)
- 7.2 Theme Architecture: CSS Injection, `data-theme`, Variable Cascade
- 7.3 Light Themes: Dayspring, Meadow, Lavender, Rosewood
- 7.4 Dark Themes: Vesper, Evergreen, Twilight, Obsidian
- 7.5 Flag Themes: America, Guatemala, Mexico, Germany, Afghanistan
- 7.6 Interface Studio — 30+ Fine-Grained Style Controls
- 7.7 Theme Persistence: Server Sync vs. localStorage Fallback
- 7.8 Adding a New Theme — Step by Step

---

## Part III — Features & Modules

**Chapter 8: Authentication & Security — Firm Foundation**
- 8.1 The Auth Flow: Login, Register, Forgot/Reset Password
- 8.2 Password Security: SHA-256, Per-User Salt, Server-Side Pepper
- 8.3 Session Tokens: 6-Hour TTL, `sessionStorage` Auto-Clear
- 8.4 RBAC: The 6 Levels (readonly → volunteer → care → leader → pastor → admin)
- 8.5 Per-User Permission Overrides (GRANT/DENY)
- 8.6 The 7 Mail-Control Groups and PII Email Routing
- 8.7 The `limitpii` Hard Block
- 8.8 Care Notes Visibility — Seed Admin & Lead Pastor Only
- 8.9 Lockdown Mode
- 8.10 Local Bypass Mode (Development Only)

**Chapter 9: The People Engine — The Shepherd**
- 9.1 Unified Member Search
- 9.2 Full Profile View — Collapsible Sections
- 9.3 Profile Editing — Multi-Table 3-Step Save
- 9.4 Member Creation Flow
- 9.5 Permissions Display per Member
- 9.6 The Member Directory

**Chapter 10: Pastoral Care — The Life**
- 10.1 The My Flock Portal — Pastoral Command Hub
- 10.2 Overview Dashboard: Metrics Strip, Open Cases, Follow-Ups Due
- 10.3 The 24 Care Type Workflows (Full Reference Table)
- 10.4 Care Case Lifecycle: Create → Assign → Stage Progression → Resolve
- 10.5 Structured Assessment Fields: Risk Level, Support Presence, Spiritual State, Trend
- 10.6 Priority System: Low/Normal/High/Urgent with Auto-Elevation
- 10.7 Review Cadence & Next Review Date (Auto-Calculated)
- 10.8 Closure Validation — Modal Checklists per Care Type
- 10.9 Watch-For Alerts — Amber Warning Panels
- 10.10 Overdue Tracking — Badge System (7d/14d Thresholds)
- 10.11 Case Linking — Parent/Child Relationships
- 10.12 Caregiver Workload Visibility — Active Case Counts in Dropdowns
- 10.13 Interaction Timeline — Adding & Viewing Touchpoints
- 10.14 The SCC Schema — 25 Columns Explained
- 10.15 Prayer Request Management
- 10.16 Compassion & Benevolence Tracking
- 10.17 Outreach Pipeline
- 10.18 Discipleship Tracking
- 10.19 Communications Panel
- 10.20 Pastoral Notes (Confidential)

**Chapter 11: The Interaction Ledger — The Scrolls**
- 11.1 30+ Touchpoint Types — Complete Reference
- 11.2 The Searchable Timeline
- 11.3 localStorage Storage (2,000-Entry Cap)
- 11.4 How Interactions Tie to Care Cases

**Chapter 12: Groups & Attendance — The Fold**
- 12.1 Small Group Management
- 12.2 Bible Study Tracking
- 12.3 Attendance Records with KPI Ribbons

**Chapter 13: Ministry, Events & Worship — The Harvest**
- 13.1 Events Management
- 13.2 Sermon Library
- 13.3 Service Plans
- 13.4 Ministry Teams
- 13.5 Volunteer Scheduling
- 13.6 Recurrence & Visibility Helpers

**Chapter 14: Song Library & Music Stand — The Shofar**
- 14.1 Song CRUD & Arrangement Management
- 14.2 ChordPro Parsing
- 14.3 Setlist Builder
- 14.4 Live Music Stand — Chord Charts with Transposition
- 14.5 PDF Lead-Sheet Export

**Chapter 15: Calendar, Tasks & Check-In — The Seasons**
- 15.1 Calendar Views: Month, Week, Day, Agenda
- 15.2 Personal Events & Church Events
- 15.3 iCal Feed Generation
- 15.4 Recurrence Rules
- 15.5 Task Management System
- 15.6 Attendance Check-In Hub

**Chapter 16: Real-Time Communications — The Upper Room**
- 16.1 Firebase Firestore Real-Time Architecture
- 16.2 Direct Messages
- 16.3 Chat Rooms & Channels
- 16.4 Notifications & Unread Counters
- 16.5 Typing Indicators
- 16.6 Per-Church Firebase Project Boundary
- 16.7 Timeout Wrapping (8-Second Safety)

**Chapter 17: Learning & Spiritual Formation — The Way & The Truth**
- 17.1 The 16-Tab Learning Dashboard
- 17.2 Courses & Curriculum
- 17.3 Quizzes & Assessments
- 17.4 Bible Reading Plans
- 17.5 Theology Reference
- 17.6 Greek/Hebrew Lexicon
- 17.7 Apologetics Library
- 17.8 Counseling Content
- 17.9 Devotionals
- 17.10 Heart Check Self-Assessment
- 17.11 Mirror — Personal Reflection
- 17.12 Certificates & Analytics
- 17.13 The Truth Editor — Content CRUD (Firestore-Backed)
- 17.14 Dual Mode: ROOT (`flockos-truth`) vs. Church Local Firestore

**Chapter 18: Device Integration — The Trumpet**
- 18.1 Web Share API
- 18.2 Click-to-Call & SMS
- 18.3 Web Notifications & App Badge
- 18.4 Camera Capture & Image Resize
- 18.5 QR Code Generation
- 18.6 Geolocation & Haversine Radius Check
- 18.7 Fullscreen Mode
- 18.8 Graceful Degradation on Unsupported Browsers

---

## Part IV — Data & Offline

**Chapter 19: The API Client — The True Vine**
- 19.1 The Four Branches: Matthew, Mark, Luke, John
- 19.2 3-Tier Endpoint Failover
- 19.3 Local Resolver Mode (Wellspring Integration)
- 19.4 Session Management (6-Hour TTL, 30-Second Timeout)

**Chapter 20: Offline Engine — The Wellspring**
- 20.1 How Fully Offline Works — Not Degraded, the Full Platform
- 20.2 Importing .xlsx into IndexedDB
- 20.3 `LOCAL_RESOLVER` — API Calls Routed Locally
- 20.4 SheetJS Parser Integration

**Chapter 21: Backup, Restore & Templates — The Well**
- 21.1 Generating Blank .xlsx Templates (200-Tab Schema)
- 21.2 Live Data Backup from TheVine
- 21.3 Restoring from .xlsx Uploads
- 21.4 The Complete Schema Definition

**Chapter 22: The Service Worker — The Living Water**
- 22.1 Cache Strategy: Cache-First for Static, Network-First for API
- 22.2 Pre-Cached App Shell (15 HTML, 20 JS)
- 22.3 Cache Versioning (`flockos-v3.25`)
- 22.4 Offline API Fallback Behavior
- 22.5 Updating the Service Worker

**Chapter 22½: Firestore Read Optimization & Timestamp Handling**
- 22½.1 Read Volume Analysis (April 2025)
- 22½.2 Optimization Strategy
- 22½.3 Estimated Impact
- 22½.4 Timestamp Normalization — `_ts()` handles `{ _seconds }`, `{ seconds }`, and `"Timestamp(seconds=...)"` string form; outputs `MM/DD/YYYY HH:MM:SS`

---

## Part V — Deployment & Operations

**Chapter 23: Multi-Church Deployment**
- 23.1 The Church Config JSON Schema
- 23.2 `build_churches.sh` — How the Build Works
- 23.3 Adding a New Church — Step by Step
- 23.4 Branding: Name, Colors, Logo, Favicon, Tagline
- 23.5 Firebase Project per Church
- 23.6 Active Deployments: FlockOS Root, TBC, TheForest, GAS

**Chapter 24: GAS Backend Deployment**
- 24.1 The 0-Deployment and Connection Guide (4 Connection Types A–D)
- 24.2 Step-by-Step: Google Sheet → Apps Script → Code.gs → Web App
- 24.3 Script Properties Configuration
- 24.4 `setupFlockOS()` — Provisioning 70+ Sheet Tabs
- 24.5 Deploying as a Web App
- 24.6 Registering the Endpoint URL
- 24.7 Managing Multiple GAS Variants (1-FlockOS, 2-TBC, 3-TheForest)
- 24.8 The Bezalel Matrix — Visual Architecture & Code Generator

**Chapter 25: Firebase & Cloud Functions**
- 25.1 Firebase Project Setup
- 25.2 Firestore Security Rules
- 25.3 Firestore Indexes
- 25.4 Cloud Functions:
  - `syncToSheets` — Firestore → GAS Sheet real-time write
  - `syncMessages` — Chat message sync
  - `syncGroupMembers` — Small group membership sync
  - `syncCardLinks` — Member card link sync
  - `syncProblems` — Outbound GitHub Issues sync
  - `syncMasterConfig` — Master config propagation
  - `pushAllMasterConfig` — Callable: push config to all churches
  - `sendPushNotification` — Callable: FCM push delivery
  - `pushOnCriticalCare` — Auto-push on critical care writes
  - `dailyPastoralSummaryTask` — Scheduled 14:00 UTC daily digest
  - `processScheduledReports` — Scheduled Monday 07:00 reports
  - `syncGitHubInbound` — Scheduled: pull GitHub issue status back
- 25.5 The `settings/sync` Config Document
- 25.6 GitHub Issues Sync (`syncProblems` + `syncGitHubInbound`)
- 25.7 `firebase deploy --only firestore`
- 25.8 Monitoring & Debugging

**Chapter 26: Frontend Deployment (GitHub Pages)**
- 26.1 `npm run build:churches` → `git push origin main`
- 26.2 The Build Pipeline
- 26.3 Capacitor: `build:www`, `cap:sync`, `cap:ios`, `cap:android`
- 26.4 The iOS Native Shell

**Chapter 27: Daily Pastoral Email & Automated Triggers**
- 27.1 `dailyPastoralSummary` — 6 AM Daily Email
- 27.2 Email Content: Open Cases, Reviews Due, Prayer Requests, Missions Focus
- 27.3 `careFollowUpReminder` — Follow-Up Nudges
- 27.4 Pastoral Slot Routing (PASTORAL_SLOT_1–10)
- 27.5 Trigger Installation & Maintenance

---

## Part VI — Continuity & Reference

**Chapter 28: Development Tools & Workflow**
- 28.1 Project Structure — Complete Directory Map
- 28.2 The Golden Rules: Edit in FlockOS Only, Update Both Master HTMLs
- 28.3 Development Scripts Reference (build, bundle, minify, seed, import, smoke test)
- 28.4 Syntax Checking: `node -c`
- 28.5 The Debugging Issues Log
- 28.6 The Brag Book — What Was Built & When

**Chapter 29: Extending FlockOS**
- 29.1 Adding a New Module — The Pattern (Script + Tab Registration + Sidebar Entry)
- 29.2 Adding a New Care Type — `_careCFG` Structure
- 29.3 Adding a New Sheet Tab — Backend + Sync + Frontend
- 29.4 Adding a New API Action
- 29.5 Adding a New Theme
- 29.6 Adding a New Church
- 29.7 The 150 Plan — Remaining Roadmap Items

**Chapter 30: If Something Happens — Operational Continuity**
- 30.1 What You Need: Google Account, GitHub Account, Firebase Console
- 30.2 Where Everything Lives — Complete Inventory
- 30.3 Credentials & Secrets — What's Stored Where
- 30.4 How to Update GAS Backend for All Churches
- 30.5 How to Add/Remove a Church
- 30.6 How to Restore from Backup
- 30.7 How to Debug a Broken Deployment
- 30.8 How to Rebuild Everything from Scratch
- 30.9 Emergency Contacts & Handoff Checklist

---

## Appendices

**Appendix A: Complete API Action Reference** (All 200+ endpoints)
**Appendix B: Complete Sheet Tab Schema** (All 200 tabs, all columns)
**Appendix C: RBAC Permission Matrix** (6 levels × all modules)
**Appendix D: The 24 Care Type Workflows** (Full stage/checklist/watch-for reference)
**Appendix E: Church Config JSON Schema** (All fields documented)
**Appendix F: Script Properties Reference** (All GAS config keys)
**Appendix G: Firestore Collection Map** (All collections and their schemas)
**Appendix H: Biblical Name Glossary** (Every name → scripture → functional meaning)
**Appendix I: The FlockOS Timeline** (Development milestones)

---

## Master Copy Files (A–R + X-Bezalel)

These files in the `Flock Docs/` folder are the **authoritative master copies** — not archives. The Planning folder has been retired; P, Q, and R are the promoted replacements.

| File | Contents |
|---|---|
| `A-Table of Contents.md` | This document — master index for all Flock Docs |
| `B-Self-Hosting Guide.md` | Self-hosting guide for churches outside the central registry |
| `C-Deployment and Connection.md` | Step-by-step deployment & Firebase connection |
| `D-Bezalel Dependencies.md` | Bezalel tool dependency reference |
| `E-Sync Secrets.md` | Script Properties & secrets configuration |
| `F-Something Important.md` | Critical operational notes |
| `G-Verified Endpoints.md` | Confirmed working Cloud Function endpoints |
| `H-End to End Plan.md` | Architecture & optimization roadmap (Phases 0–8); Phases 0 & 1 complete |
| `I-Firestore Reduction.md` | Firestore read reduction analysis — worst offenders, limits, strategy |
| `J-Firestore Rules.md` | Firestore security rules — master copy |
| `K-Flock Docs.md` | The complete FlockOS guide (Chapters 1–30 + Appendices) |
| `L-Master Code.md` | Full GAS backend master (Code.gs, ~28,000 lines) |
| `M-Master FirestoreSync.md` | FirestoreSync.gs master (hourly sync + seeding + migration) |
| `N-Master SyncHandler.md` | SyncHandler.gs master — Firestore → Sheet real-time handler; `_ts()` normalizes all timestamp formats to `MM/DD/YYYY HH:MM:SS` |
| `O-Master Cleanup FlockOS.md` | DeleteUnknownTabs.gs — 3-mode tab cleanup utility |
| `P-Instructions for Master.md` | Multi-church build system reference — `build_churches.sh`, Master-API.json config, church config schema |
| `Q-The 150 Plan.md` | Active development roadmap — Tiers 1–3 complete; Tier 4 attempted & reverted |
| `R-Permissions Plan.md` | Permissions architecture — Role vs. Permission design philosophy + full permission matrix |
| `X-Bezalel.html` | Bezalel local deployment tool — Script Properties generator + GAS code copier + Flock Docs Library |

---