# Herald — Startup and Render Bootstrap Flow

## Summary
Herald is a self-contained, client-side newspaper runtime. When the app entry point opens, the browser does not run a compile/build step; it loads a single ES module bootstrap that constructs the shell, restores local auth state, registers live-update plumbing, and renders the current route into separate public/private roots.

The important thing to know is that the startup path is centered on `Scripts/bootstrap.js` and `Scripts/newspaper-shell.js`, not on the more general `Scripts/router.js` pipeline. `router.js` exists as a separate edition/content assembly system, but the default app entry point in `index.html` does not instantiate it.

## What happens immediately after `Herald/index.html` opens
The startup sequence is:

1. **`index.html` loads a module script**
   - `Herald/index.html` contains only the DOM shell and:
     ```html
     <script type="module" src="./Scripts/bootstrap.js"></script>
     ```
   - That means the browser loads `bootstrap.js` directly, without bundling logic in the page itself.

2. **`bootstrap.js` waits for DOM readiness if needed**
   - If the document is still loading, it registers a one-time `DOMContentLoaded` handler.
   - Otherwise, it starts immediately.

3. **`startHerald()` runs once**
   - The startup function is idempotent: if `appState.started` is already true, it returns the existing runtime object.
   - This prevents duplicate listeners, duplicate shell creation, and duplicate service-worker registration.

4. **The app restores auth state**
   - It reads `localStorage["herald.authenticated"]`.
   - `true` becomes the initial authenticated state; anything else is treated as unauthenticated.
   - This is a simple local-browser flag, not a remote login flow.

5. **The shell is built**
   - `createHeraldShell()` locates:
     - `#herald-app`
     - `#herald-shell`
     - `#herald-public-root`
     - `#herald-private-root`
     - `#herald-status`
   - It then builds the masthead, navigation, and footer inside `#herald-shell`.
   - It also wires navigation clicks so route changes are handled in-app instead of by full page reloads.

6. **Parity inventory loading begins in the background**
   - `loadParityInventory()` is kicked off asynchronously.
   - The result is stored in `appState.parityInventory` when it resolves.
   - This does not block first paint; it is a post-start enrichment step.

7. **The runtime API is published**
   - `window.HERALD_RUNTIME` is populated with the live runtime controls:
     - `navigate()`
     - `render()`
     - `registerRouteRenderer()`
     - `setAuthState()`
     - `showStatus()`
     - `clearStatus()`
     - `refresh()`
   - This gives other code a stable control surface after startup.

8. **History navigation is wired**
   - A `popstate` listener is added so back/forward navigation re-renders the current route.

9. **The service worker is registered if supported**
   - If the browser supports service workers and the context is secure, Herald registers:
     - `../the_living_water.js`
   - Update listeners are attached so the UI can show a refresh banner when a new worker is waiting.

10. **The initial route is normalized and rendered**
    - The current URL is converted into a canonical route.
    - If the pathname does not match the normalized route, history is corrected with `replaceState`.
    - `renderRoute()` then paints the first view.

## Architecture
Herald uses a client-side SPA-style shell with route-driven rendering and a split-root layout:

- **Shell layer**
  - `newspaper-shell.js` owns the persistent chrome: masthead, nav, footer, status banner, and the public/private mount points.
- **Route/render layer**
  - `bootstrap.js` owns route state, auth state, history sync, render dispatch, and service-worker lifecycle.
- **Section modules**
  - `Sections/public/*.js` and `Sections/private/*.js` are lazily imported by route and are responsible for the actual page content.
- **Normalization/registry layer**
  - `route-contracts.js`, `story-models.js`, and `edition-registry.js` define route identity, section metadata, and content contracts.
- **Data-loading layer**
  - `content-loader.js` and `router.js` form a more data-driven edition/source-map pipeline that is separate from the default bootstrap path.

### Technology stack
- Plain browser ES modules
- DOM APIs, History API, `localStorage`, dynamic `import()`
- Service worker module registration
- No React/Vue/Svelte runtime in this app path

### Execution model
The main runtime loop is event-driven:
- initial load → shell build → route render
- navigation click / `popstate` → `navigate()` / `renderRoute()`
- auth change → `setAuthState()` → re-render
- service-worker update event → status banner → refresh action

## Key abstractions

### `startHerald()`
- **File**: `Herald/Scripts/bootstrap.js`
- **Responsibility**: One-time application startup orchestration.
- **What it does**: Restores auth state, creates the shell, loads parity data, registers the runtime API, binds `popstate`, registers the service worker, and renders the first route.
- **Why it matters**: This is the real entry point after `index.html`.
- **Used by**: The module’s bottom-of-file DOM readiness hook.

### `createHeraldShell()`
- **File**: `Herald/Scripts/newspaper-shell.js`
- **Responsibility**: Build and manage the persistent app chrome.
- **What it does**: Creates the masthead, nav, footer, status banner, route-link state, and the public/private content roots.
- **Why it matters**: It enforces the split-root layout and the route-aware navigation UI.
- **Used by**: `bootstrap.js`, which mounts all route content through this shell.

### `renderRoute()`
- **File**: `Herald/Scripts/bootstrap.js`
- **Responsibility**: Route selection and rendering dispatch.
- **What it does**: Canonicalizes the route, updates document title, picks the renderer, handles private-gate fallback, and mounts content into the shell.
- **Why it matters**: This is the central render decision point after startup.
- **Used by**: `navigate()`, `setAuthState()`, `handlePopState()`, and the initial startup flow.

### `renderSectionPage()`
- **File**: `Herald/Scripts/bootstrap.js`
- **Responsibility**: Lazy-load and render a route-specific section module.
- **What it does**: Dynamically imports the section module, builds a route record, calls the module’s `render()` function, and mounts the result into either the public or private root.
- **Why it matters**: This is how Herald avoids eagerly loading every section on startup.
- **Used by**: Route renderers such as front page, news, archive, about, missions, theology, apologetics, invitation, and reading.

### `renderPublic()`
- **File**: `Herald/Scripts/render-public.js`
- **Responsibility**: Render the data-driven public edition view.
- **What it does**: Builds the public broadsheet layout, nav rail, article surface, and teaser rail from edition/section/story data.
- **Why it matters**: This is the higher-level public edition renderer used by the alternate router pipeline.
- **Used by**: `router.js`.

### `renderPrivate()`
- **File**: `Herald/Scripts/render-private.js`
- **Responsibility**: Render the private edition view and auth gate.
- **What it does**: Shows the auth banner, locked state, or private section content depending on the auth snapshot.
- **Why it matters**: It cleanly separates unauthorized, pending, and authorized private flows.
- **Used by**: `router.js`.

### `createAuthGate()`
- **File**: `Herald/Scripts/auth-gate.js`
- **Responsibility**: Resolve and monitor authorization state for the alternate router pipeline.
- **What it does**: Reads auth from globals, body dataset, local/session storage, or events; exposes `getSnapshot()`, `whenReady()`, and change listeners.
- **Why it matters**: The private edition pipeline can start in a pending state and settle later.
- **Used by**: `router.js`, `renderPrivate()`.

### `loadEditionBundle()` / `loadSourceMap()`
- **File**: `Herald/Scripts/content-loader.js`
- **Responsibility**: Fetch and normalize edition data and source maps.
- **What it does**: Loads JSON, resolves story references, dedupes and sorts stories, and produces normalized section/story records.
- **Why it matters**: This is the data-shaping layer for the alternate edition-driven renderer.
- **Used by**: `router.js`.

### `createRouter()`
- **File**: `Herald/Scripts/router.js`
- **Responsibility**: A standalone edition/content router.
- **What it does**: Resolves route locations, loads source maps and edition bundles, reacts to auth changes, and renders public/private surfaces.
- **Why it matters**: This is a second architecture path in the codebase; it is not the default startup path from `index.html`.
- **Used by**: Higher-level consumers outside the bootstrap entry point.

## Data flow
The default app startup path is:

1. `Herald/index.html` loads `Scripts/bootstrap.js`.
2. `bootstrap.js` waits for DOM readiness if necessary, then calls `startHerald()`.
3. `startHerald()` reads auth from `localStorage`, creates the shell, publishes `window.HERALD_RUNTIME`, and starts parity inventory loading.
4. It binds `popstate` and tries to register the service worker.
5. It resolves the initial route from `window.location`.
6. `renderRoute()` selects a renderer for that route.
7. Simple routes call a section renderer; section renderers dynamically import `Sections/.../*.js`.
8. The route module renders content into the shell’s public or private root.
9. If the route is `/private` and auth is false, a lock screen is rendered instead.
10. Update notifications from the service worker are surfaced through the shell’s status banner.

## Non-obvious behaviors and design decisions

- **This is not a traditional build step**
  - The “build process” here is runtime DOM construction, not a compile phase.
  - The browser loads one module and the app assembles itself in-place.

- **Two rendering systems exist side by side**
  - `bootstrap.js` is the live entry path.
  - `router.js` / `render-public.js` / `render-private.js` are a more data-driven edition pipeline.
  - That split can be confusing unless you know the bootstrap path is the one used by `index.html`.

- **Auth is intentionally local**
  - The default runtime stores auth in `localStorage["herald.authenticated"]`.
  - The private desk can be opened and closed without any backend dependency.

- **Public and private roots are separate DOM targets**
  - `#herald-public-root` and `#herald-private-root` are both real mount points.
  - The shell toggles their visibility rather than swapping a single container.

- **Route renders are cancellation-safe**
  - `renderToken` increments on each render so stale async section imports cannot overwrite newer navigation state.

- **Service-worker updates are user-driven**
  - New workers do not automatically replace the active runtime.
  - Herald shows a status banner with “Refresh now” and “Force refresh” actions.

- **Navigation is hijacked intentionally**
  - The shell intercepts clicks on `data-herald-route` anchors to keep routing client-side.

- **The first render may occur before all async enrichment is ready**
  - Parity inventory loading happens in the background.
  - The first paint prioritizes shell availability over completeness.

## Module reference

| File | Purpose |
|------|---------|
| `Herald/index.html` | App entry point; mounts shell containers and loads `bootstrap.js` as an ES module |
| `Herald/Scripts/bootstrap.js` | Main startup coordinator, route renderer, auth state, service-worker wiring |
| `Herald/Scripts/newspaper-shell.js` | Persistent shell chrome and public/private root management |
| `Herald/Scripts/route-contracts.js` | Route canonicalization and route contract lookup helpers |
| `Herald/Scripts/story-models.js` | Story/section normalization, dedupe, sorting, and lookup helpers |
| `Herald/Scripts/content-loader.js` | Fetches and normalizes source maps and edition bundles |
| `Herald/Scripts/edition-registry.js` | Static registry of section modules and public/private editions |
| `Herald/Scripts/render-public.js` | Data-driven public edition renderer |
| `Herald/Scripts/render-private.js` | Data-driven private edition renderer and auth gate |
| `Herald/Scripts/auth-gate.js` | Authorization snapshot/resolution helper for the router pipeline |
| `Herald/Scripts/service-worker-contract.js` | Shared message protocol for update/refresh behavior |
| `Herald/the_living_water.js` | Service worker entry file used by the runtime |
| `Herald/Styles/herald.css` | Presentation layer for the shell, sections, cards, nav, and status banner |
| `Herald/Data/public-edition.json` | Public edition bundle consumed by the data-driven renderer |
| `Herald/Data/private-edition.json` | Private edition bundle consumed by the data-driven renderer |
| `Herald/Data/source-map.json` | Story/section source map used to normalize edition data |

## Suggested reading order
1. `Herald/index.html` — to see the actual entry point and DOM mount points.
2. `Herald/Scripts/bootstrap.js` — to understand the real runtime startup sequence.
3. `Herald/Scripts/newspaper-shell.js` — to see how the app chrome and public/private roots are built.
4. `Herald/Scripts/route-contracts.js` — to understand how routes are canonicalized and matched.
5. `Herald/Scripts/edition-registry.js` — to see the section/module registry and edition split.
6. `Herald/Scripts/router.js` — to understand the alternate content-driven edition pipeline that exists alongside the bootstrap path.
