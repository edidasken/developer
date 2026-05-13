# New Covenant — Architecture Overview

## 1. Entry Point & Boot Sequence

The application's bootstrapping sequence initiates with the loading of `index.html` and proceeds through a series of script and resource fetches:

1.  **HTML Document Load & Meta Configuration**: The browser loads `index.html`. It immediately processes PWA-related `<meta>` tags (e.g., `theme-color`, `mobile-web-app-capable`), loads the `manifest.json`, and defines various icons for different platforms. Open Graph meta tags are also present for social media sharing.
2.  **Resource Preconnection & DNS Prefetch**: Critical external resources are pre-emptively connected or prefetched using `<link rel="preconnect">` and `<link rel="dns-prefetch">`. This includes Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), Firebase Firestore (`firestore.googleapis.com`), and Firebase Authentication endpoints (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`).
3.  **Stylesheet Loading**: Two global stylesheets are loaded: `Styles/american_garments.css` (designated as the "source of truth") followed by `Styles/new_covenant.css`.
4.  **ES Module Preloading**: A comprehensive list of ES modules essential for the initial boot and home view graph are preloaded using `<link rel="modulepreload">`. This instructs the browser to fetch and compile these modules in parallel, collapsing sequential network waterfalls into a single, faster operation.
5.  **Flash Prevention & Initial Layout CSS**: An inline `<style>` block provides minimal CSS to prevent a flash of unstyled content and sets up initial CSS variables for theming. It also defines the primary CSS Grid layout for the application shell (`.veil-wrap`) and its responsive breakpoints.
6.  **HTML Application Shell Render**: The static HTML structure for the application shell is rendered. This includes a `div.veil-wrap` containing `header#the-veil-top`, `nav#the-veil-side`, `main#the-holy-place`, `footer#the-veil-foot`, and `div#the-staff-host`. These elements serve as containers for dynamically loaded content.
7.  **Covenant Query Parameter Enforcement**: An inline JavaScript `<script>` block checks for the `?covenant=new` query parameter in the URL. If absent, it's added via `history.replaceState`, ensuring the New Covenant shell is always active within this deployment.
8.  **Firebase Configuration**: A global `window.FLOCK_FIREBASE_CONFIG` object is defined inline, providing all necessary Firebase project credentials (`apiKey`, `authDomain`, `projectId`, etc.) for the client-side Firebase SDK.
9.  **Legacy Backend Script Loading**: Several legacy backend JavaScript files are loaded with the `defer` attribute. These include Firebase compatibility SDKs (`firebase-app-compat.js`, `firebase-firestore-compat.js`, `firebase-auth-compat.js`, `firebase-functions-compat.js`) and application-specific backend integration scripts (e.g., `firm_foundation.js`, `the_upper_room.js`, `the_true_vine.js`). These scripts populate global objects (e.g., `TheVine`, `Nehemiah`, `UpperRoom`) that the ES module system will interact with via `the_window_bridge.js`.
10. **ES Module Application Bootstrap**: The core ES module application starts with `<script type="module" src="Scripts/the_ark.js">`. This module, and its imports, will dynamically populate the HTML application shell and handle further application logic.

## 2. Router / Shell Architecture

The application employs a static HTML shell that is dynamically populated and managed by client-side JavaScript, leveraging ES Modules for a modular architecture:

*   **Static Shell**: `index.html` provides the foundational `div.veil-wrap` container, which uses CSS Grid to define regions for a top bar (`#the-veil-top`), sidebar (`#the-veil-side`), main content area (`#the-holy-place`), and footer (`#the-veil-foot`). A `div#the-staff-host` is also present for dynamic UI elements like toasts or modals.
*   **Core ES Module**: `Scripts/the_ark.js` serves as the primary entry point for the ES module-based application logic.
*   **Chrome (UI Shell)**: `the_ark.js` imports `Scripts/the_veil/index.js`, which is responsible for rendering the application's chrome (top bar, sidebar, footer) into the respective `#the-veil-` elements. Sub-modules like `the_crown.js`, `the_pillars.js`, `the_courtyard.js`, and `the_hem.js` contribute to these UI components.
*   **Client-Side Routing**: The application uses a client-side router, indicated by the `Scripts/the_scribes/index.js` module and its related files (`the_path.js`, `the_chronicle.js`, `the_herald.js`). These modules are responsible for managing navigation, updating the URL, and loading the correct view into the `main#the-holy-place` container.
*   **Dynamic View Loading**: Views are loaded dynamically as needed. The `modulepreload` hints in `index.html` explicitly preload the main `Views/_frame.js` and the home view `Views/the_good_shepherd/index.js` and its components (`the_pasture.js`, `the_count.js`, `the_flock_feed.js`, `the_next_steps.js`, `the_call.js`). This suggests that initial views are eagerly loaded, while other views would be loaded on demand via dynamic `import()`.
*   **View Lifecycle Management**: When `TheShepherd.openProfile()` is called, the current view's content in `_container` (which is likely `#the-holy-place`) is replaced. Similarly, `TheShepherd.backToList()` causes the `_allPeople` cache to be cleared and `renderApp(_container)` to be called, implying that views are destroyed and re-rendered or re-initialized.

## 3. Authentication Flow

Authentication and authorization are managed by `Scripts/firm_foundation.js` (aliased as `Nehemiah`) in conjunction with `TheVine` (Google Apps Script API) and Firebase Auth:

*   **Authentication Check (`isAuthenticated`)**: This function determines if a user is currently logged in. It first checks for a valid session object stored by `TheVine.session()`. As a fallback, it checks `firebase.auth().currentUser` to see if Firebase Auth has an active user, indicating a persistent login across browser tabs or refreshes.
*   **Session Storage**: Successful login leads to the session and user profile information being saved into `sessionStorage` under keys like `flock_auth_session` and `flock_auth_profile`.
*   **Guarding Pages (`guard`, `guardLogin`)**:
    *   `Nehemiah.guard()` is called at the beginning of protected pages. If no valid session is found, it attempts to restore a minimal session from `firebase.auth().currentUser`. If unsuccessful, the user is redirected to `LOGIN_PAGE` (`the_wall.html`).
    *   `Nehemiah.guardLogin()` is used on the login page itself to redirect already authenticated users to the `APP_PAGE` (`the_good_shepherd.html`).
*   **Login Process (`login`)**:
    *   The `login(email, passcode)` function uses `TheVine.john.auth.login()` to authenticate against the Google Apps Script backend.
    *   On successful authentication, it stores the returned session and profile data locally.
    *   It then attempts to authenticate with Firebase Auth using `UpperRoom.init()` and `UpperRoom.authenticate()`, ensuring that real-time Firestore features are also authenticated.
*   **Logout Process (`logout`)**:
    *   `Nehemiah.logout()` clears the local session by calling `TheVine.john.auth.logout()`.
    *   It also signs out from Firebase Auth using `firebase.auth().signOut()` and `UpperRoom.signOut()`.
    *   A visual "farewell card" is displayed for 25 seconds before the user is redirected to the `PUBLIC_PORTAL`.
*   **Authorization (`hasRole`, `canAccess`, `can`, `hasGroup`, `requireRole`)**:
    *   `Nehemiah` provides functions to check a user's role level (`hasRole`), access to specific modules (`canAccess`), or fine-grained capabilities (`can`) based on a `permissions` map within the session or profile.
    *   `requireRole(minRole)` throws an error if the user's role is insufficient.
    *   `_getGroups()` retrieves group memberships from the session or profile, enabling group-based access control (`hasGroup`).
*   **Password Reset & Registration**: Functions for `register`, `forgotPassword`, and `resetWithCode` are exposed, all communicating with `TheVine.john.auth` methods.
*   **Local Security Bypass**: For local development, `firm_foundation.js` includes a mechanism to bypass authentication, injecting a synthetic admin session if `enableLocalBypass()` is called in a local environment (`file://`, `localhost`, `127.0.0.1`).

## 4. Firestore Sync Strategy

The application employs a "Firestore-first / GAS-fallback" strategy for data persistence and synchronization, facilitated by `the_living_water_adapter.js`:

*   **Adapter Pattern**: The `buildAdapter(domain, V)` function creates an object that acts as an intermediary for API calls related to a specific data domain (e.g., `flock.sermons`, `flock.events`, `flock.members`).
*   **Firestore-First Logic**: For any given API call, the adapter first checks if `window.UpperRoom` is ready (i.e., `UpperRoom.isReady()` returns true). `UpperRoom` represents the direct client-side interface to Firebase Firestore. If ready, the call is routed to the corresponding `UpperRoom` method.
*   **Google Apps Script (GAS) Fallback**: If `window.UpperRoom` is not ready, the adapter falls back to using `window.TheVine` (aliased as `V` in `the_living_water_adapter.js`), which represents the Google Apps Script API. This ensures that the application remains functional even if the Firestore integration is not fully initialized or if `UpperRoom` is explicitly disabled.
*   **Domain Mapping**: The `_DOMAIN_MAP` object defines how specific GAS API paths (e.g., `flock.events`) map to corresponding `UpperRoom` methods (e.g., `listEvents`). It also provides mechanisms (`urArgs`, `gasCall`) to normalize argument shapes between the `UpperRoom` and `TheVine` APIs when they differ.
*   **Hybrid Backend**: This architecture allows the application to leverage the real-time capabilities and direct client-side access of Firestore while retaining the robust backend logic and email/auth functionality provided by Google Apps Script. GAS is explicitly stated to remain authoritative for email sending and authentication regardless of the Firestore status.
*   **Firebase SDKs**: The `index.html` loads Firebase compatibility SDKs (`firebase-app-compat.js`, `firebase-firestore-compat.js`) which are likely used by `UpperRoom` for direct Firestore interactions.
*   **Offline Caching**: The service worker (`the_living_water.js`) provides offline caching for static assets and navigation, complementing the data synchronization strategy by enabling offline UI access.

## 5. CSS / Styling Architecture

The styling architecture for the New Covenant application focuses on a consistent, theme-aware design with specific considerations for performance and responsiveness:

*   **Global Stylesheets**:
    *   `Styles/american_garments.css` is loaded first and serves as the primary "source of truth" for core styles, including fonts (likely importing from Google Fonts) and common UI components.
    *   `Styles/new_covenant.css` is loaded second, indicating it may contain specific styles or overrides tailored for the New Covenant shell.
*   **Web Fonts**: Google Fonts are loaded via `<link>` tags, ensuring consistent typography. Preconnect hints optimize their loading.
*   **Flash Prevention CSS**: An inline `<style>` block directly within `index.html` serves two main purposes:
    *   **Initial Theming**: It sets essential CSS custom properties (`--bg`, `--bg-raised`, `--ink`, `--line`) that define the application's base color palette.
    *   **Layout & Responsiveness**: It establishes the foundational CSS Grid layout for the main application shell (`.veil-wrap`) and defines basic responsive breakpoints for mobile (`@media (max-width: 860px)`). This ensures a usable layout even before external stylesheets are fully parsed.
*   **JavaScript-driven Theming**: A comment in `index.html` explicitly states "the_adornment.js applies data-theme after boot." This indicates that the application likely uses JavaScript to dynamically set a `data-theme` attribute on the `<html>` or `<body>` element. This attribute, combined with CSS rules that target `[data-theme="dark"]` (or other themes), enables dynamic theme switching.
*   **Component-Level Styling**: While not explicitly shown in the provided files, the helper functions `_badge` and `_statusBadge` in `the_shepherd.js` indicate a pattern of generating styled HTML snippets for common UI elements. These snippets use predefined CSS classes (e.g., `badge`, `badge-info`) that would be defined in the global stylesheets.

## 6. PWA / Manifest

The application is configured as a Progressive Web App (PWA) with a defined service worker strategy and manifest:

*   **PWA Manifest**:
    *   `index.html` includes `<link rel="manifest" href="manifest.json">`, pointing to the web app manifest file.
    *   `<meta>` tags (`theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`) provide additional PWA configuration and control the appearance when installed on mobile devices.
    *   Icons for various platforms are specified using `<link rel="icon">` and `<link rel="apple-touch-icon">`.
*   **Service Worker (`the_living_water.js`)**:
    *   **Versioning**: The `CACHE_NAME` constant (`flockos-new-covenant-v1.03`) is used for cache versioning, enabling controlled updates and purging of old caches.
    *   **Installation**: During the `install` event, the service worker pre-caches a defined list of essential `APP_SHELL` files (including `index.html`, core CSS and JS modules, images, and the manifest) using the `cache.addAll()` method.
    *   **Activation**: The `activate` event handles purging outdated caches by deleting any cache storage entries that do not match the current `CACHE_NAME`. `self.skipWaiting()` is called on install, and `self.clients.claim()` is called on activate to ensure the new service worker takes immediate control of the page. The page can also send a `SKIP_WAITING` message to the service worker to force activation.
    *   **Fetch Strategies**:
        *   **Google Fonts**: Uses a `_cacheFirst` strategy, serving fonts from the cache if available due to their immutability.
        *   **Navigation Requests (HTML)**: Employs a `_networkFirstNav` strategy. The network is attempted first; if offline or the network fails, it falls back to the cached `index.html` or a simple HTML offline message.
        *   **Static Assets (JS, CSS, Images)**: Uses a `_staleWhileRevalidate` strategy. The cached version is served immediately for speed, while a network request is made in the background to update the cache for future visits.
        *   **Cross-Origin/Non-GET Requests**: The service worker explicitly bypasses caching for non-GET requests and requests to external origins like Firebase APIs or Google Apps Script (GAS).
*   **Push Notifications**:
    *   The service worker handles `push` events by showing notifications (`self.registration.showNotification()`) using data received from the push message (title, body, icon, badge, etc.).
    *   The `notificationclick` event listener allows users to interact with notifications. It closes the notification and attempts to focus an existing application window or open a new one, navigating to a specified URL from the notification data.


---

## 7. Standalone App Shells (`app.*/`)

The `New_Covenant/` directory contains **eight** self-contained PWA shells that each serve a distinct deployment surface. They are separate entry points — not loaded by the main `index.html` shell — and each sets `<base href="../">` (or an absolute GitHub Pages URL) to resolve shared assets from the `New_Covenant/` root.

| Folder | Entry HTML | Title / Purpose | Auth | Manifest |
|---|---|---|---|---|
| `app.embeds/` | `embed-about.html`, `embed-feed.html`, `embed-flockchat.html`, `embed-flockos.html`, `embed-flockshow.html`, `embed-grow.html`, `embed-launcher.html`, `embed-stand.html` | Embeddable standalone pages rendered inside `<iframe>` by views that need sandboxed content. `embed-launcher.html` is a church-branded app launcher (B-Build patches `{{CHURCH_NAME}}` and `{{BASE_URL}}`). `embed-feed.html`, `embed-flockchat.html`, `embed-flockshow.html` embed their matching standalone PWAs. No PWA install; no manifest. | N (public) | None |
| `app.feed/` | `feed.html` / `index.html` | The Feed — Sermon Preparation & Manuscript Builder PWA. Auth-gated standalone shell. `feed.js` provides sermon library, structured outline builder (intro, scripture, points, illustrations, applications, transitions), full manuscript editor with word count and delivery timing. Firebase config patched per church by B-Build (step 9g). | Y | `manifest.json` |
| `app.flockchat/` | `app.flockchat.html` / `index.html` | FlockChat — Church team messaging PWA. Auth-gated standalone shell. `flockchat.js` provides channels, DMs, and real-time typing via direct Firestore compat SDK (no RTDB required; heartbeat-based typing TTL). Firebase config patched per church by B-Build (step 9e). | Y | `manifest.json` |
| `app.flockos/` | `app.flockos.html` / `index.html` | Full FlockOS PWA shell — alternate installable entry point for the main church management app. Loads the same authenticated shell as `index.html`. Firebase config patched by B-Build step 5. | Y | `manifest.json` |
| `app.flockshow/` | `app.flockshow.html` / `index.html` | FlockShow — Church Presentation App PWA. Auth-gated standalone installable shell. `flockshow.js` provides show library, slide editor (lyrics, scripture, announcement, blank slide types), live colour + font-size controls, import-from-lyrics (auto-split on blank lines), and present mode (opens projector window; keyboard/swipe navigable). Manifest name patched by B-Build step 11b. | Y | `manifest.json` |
| `app.grow/` | `app.grow.html` / `index.html` | GROW with FlockOS — public-facing spiritual growth PWA. Loads `grow_public.js` (no auth, no Firestore). Installable. | N (public) | `grow-manifest.json` |
| `app.invite/` | `app.invite.html` / `index.html` | The Invitation — standalone PWA presenting Jesus (Great Invitations, I AM Declarations, Finished Work). Absolute `<base>` points to GitHub Pages root for shareable links. No auth. | N (public) | `manifest.json` |
| `app.stand/` | `music_stand.html` / `index.html` | Music Stand — standalone worship-leader PWA. Auth-gated. Delegates all song library, chord, and presenter logic to `Scripts/the_shofar/index.js`. Manages app-level nav (dashboard, songs, services, import, settings) via `stand.js`. | Y | `manifest.json` |

> **Note:** These shells share CSS and images from the `New_Covenant/` root via the `<base href>` tag. `app.embeds/` pages use an absolute `<base>` pointing to GitHub Pages so embeds resolve correctly regardless of the host page's origin.
