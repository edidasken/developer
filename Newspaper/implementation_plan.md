# Implementation Plan

[Overview]

Keep The Newspaper as separate section URLs with a shared shell and shared data/auth utilities, rather than rewriting it into a single SPA.

The current Newspaper already has the safest shape for maintainability: each section is its own page, the shared masthead/navigation/drawer logic is centralized, and the content-heavy sections can stay independent. The right move is to reduce duplication and formalize the shared contracts, not to collapse the whole app into one router-driven screen. That preserves bookmarks, direct links, per-section auth gating, offline caching, and print-friendly behavior.

This implementation is needed because the codebase is starting to accumulate repeated page bootstrap logic and repeated assumptions about section identity. The goal is to make the Newspaper easier to maintain over time by extracting the shared structure into a few reusable modules and narrowing each section to just its own content rules. In other words, fewer moving parts, not a larger architecture.

The SPA idea is not the safest choice here. It would increase state complexity, make auth and deep links more fragile, and turn a document-style app into a bigger application shell. The recommended path is incremental refactor: keep the URLs, keep the pages, and make the common pieces shared and explicit.

[Types]

Standardize the shared section, shell, and data-resolution contracts so the Newspaper pages all behave the same way.

```ts
type SectionId =
  | 'herald'
  | 'the_way'
  | 'the_sanctuary'
  | 'the_flock'
  | 'the_mission'
  | 'the_family'
  | 'the_shepherd'
  | 'the_calendar'
  | 'the_weavers';

type RoleLevel = -1 | 0 | 2 | 3 | 4 | 5;

type DataSource = 'firestore' | 'gas' | 'localStorage' | 'static';

type ThemeToken =
  | '--gold'
  | '--accent'
  | '--lilac'
  | '--mint'
  | '--peach'
  | '--sky'
  | '--warning'
  | '--success'
  | '--rose';

interface SectionManifest {
  id: SectionId;
  label: string;
  shortLabel: string;
  url: string;
  minRole: RoleLevel;
  publicAllowed?: boolean;
  themeToken: ThemeToken;
  cssPath: string;
  scriptPath: string;
  layout: 'story' | 'grid' | 'panel';
  drawerEnabled: boolean;
}

interface ShellState {
  activeSectionId: SectionId;
  authLevel: RoleLevel;
  fontScale: 0.85 | 1 | 1.1 | 1.15 | 1.25;
  drawerOpen: boolean;
  safeTop: string;
  safeBottom: string;
  safeLeft: string;
  safeRight: string;
}

interface DataSourceResult<T> {
  data: T;
  source: DataSource;
  stale: boolean;
  error?: string;
}

interface DrawerPayload {
  title: string;
  bodyHTML: string;
  focusSelector?: string;
  onMount?: (root: HTMLElement) => void | (() => void);
}

interface BuildTarget {
  churchId: string;
  brandName: string;
  basePath: string;
  cacheName: string;
}
```

Validation rules:
- `SectionId` must match the actual `Newspaper/Sections/<section>/` folder names.
- `RoleLevel` must stay aligned with the current auth stack and existing section gating.
- `themeToken` must map only to existing shared section color tokens.
- `url` must stay relative so direct bookmarks still work from each section page.
- `DataSourceResult.source` is required so the UI can show live vs cached vs static state consistently.
- `fontScale` must stay on the fixed five-step ladder already used by the Newspaper.

[Files]

Add a small set of shared modules and update the current section pages to consume them while keeping every section on its own URL.

New files to create:
- `Newspaper/Scripts/the_section_manifest.js` — canonical section registry for nav, auth filtering, and section metadata lookup.
- `Newspaper/Scripts/the_section_shell.js` — shared shell bootstrap for masthead, safe-area padding, section page setup, and page-level initialization.
- `Newspaper/Scripts/the_data_resolver.js` — one resolver for Firestore → GAS → localStorage → static data fallback.

Existing files to modify:
- `Newspaper/Scripts/the_gates.js` — keep drawer, font-scale, and nav logic centralized; make it consume the shared manifest instead of maintaining ad hoc section assumptions.
- `Newspaper/Styles/the_broadsheet.css` — keep this as the shared foundation only; add truly global primitives here and nothing section-specific.
- `Newspaper/Styles/sections/herald.css` — retain only Herald-specific tokens and accents.
- `Newspaper/Styles/sections/the_way.css` — retain only Way-specific story layout rules and module accents.
- `Newspaper/Styles/sections/the_sanctuary.css`
- `Newspaper/Styles/sections/the_flock.css`
- `Newspaper/Styles/sections/the_mission.css`
- `Newspaper/Styles/sections/the_family.css`
- `Newspaper/Styles/sections/the_shepherd.css`
- `Newspaper/Styles/sections/the_calendar.css`
- `Newspaper/Styles/sections/the_weavers.css`
- `Newspaper/Sections/herald/index.html` and `the_proclamation.js` — keep as the reference section, but remove any duplicated boot logic that belongs in the shared shell.
- `Newspaper/Sections/the_way/index.html` and `the_way.js`
- `Newspaper/Sections/the_sanctuary/index.html` and `the_sanctuary.js`
- `Newspaper/Sections/the_flock/index.html` and `the_flock.js`
- `Newspaper/Sections/the_mission/index.html` and `the_mission.js`
- `Newspaper/Sections/the_family/index.html` and `the_family.js`
- `Newspaper/Sections/the_shepherd/index.html` and `the_shepherd.js`
- `Newspaper/Sections/the_calendar/index.html` and `the_calendar.js`
- `Newspaper/Sections/the_weavers/index.html` and `the_weavers.js`
- `Newspaper/sw.js` — keep the precache manifest aligned with any new shared modules.
- `Newspaper/manifest.json` — verify it still matches the shipping asset set.

Files to delete or move:
- No files should be deleted in this change set.
- Do not collapse the section pages into one routed SPA.
- Keep `Newspaper/ThePlan.md` as the historical build log archive.

Configuration updates:
- Keep `start_url` as `./` so the app still launches from the Newspaper root.
- Keep service worker registration working from every section page.
- Keep the current auth gating model per section.
- Keep the shared drawer and section nav bar behavior consistent across pages.

[Functions]

Centralize the repeated boot and fallback behavior into a few shared functions.

`getSectionManifest(sectionId: SectionId): SectionManifest | null`
- Purpose: Return the canonical section metadata for nav, auth, and page setup.
- Behavior: Look up the exact section definition from the shared registry.
- Parameters: `sectionId` must be one of the known section IDs.
- Return value: The matching manifest or `null` for unknown sections.
- Error handling: Unknown values should fail closed without throwing.

`buildSectionNav(activeSectionId: SectionId, authLevel: RoleLevel): HTMLElement`
- Purpose: Render the section navigation bar based on the current page and role.
- Behavior: Hide sections the user cannot access, preserve direct links for permitted sections, and mark the current page active.
- Parameters: Current section and role level.
- Return value: A fully built nav element.
- Error handling: If auth data is missing, default to the safest visible set.

`resolveSectionData<T>(options: { key: string; live: () => Promise<T>; gas: () => Promise<T>; local: () => T; staticValue: T }): Promise<DataSourceResult<T>>`
- Purpose: Resolve content through the agreed data ladder.
- Behavior: Try live Firestore first, then GAS, then localStorage, then static data.
- Parameters: The resolver callbacks and a cache key.
- Return value: The chosen data plus source metadata.
- Error handling: Never throw to the page if a lower fallback can render something.

`initializeSectionShell(options: { sectionId: SectionId; title: string; authLevel: RoleLevel; pageRoot: HTMLElement }): void`
- Purpose: Set up the shared page shell for a section page.
- Behavior: Apply safe-area padding, wire nav rendering, restore font scale, and prepare the drawer hooks.
- Parameters: The current section ID, title, auth level, and root element.
- Return value: None.
- Error handling: If one shell feature fails, the page should still render content.

`openDrawer(titleText: string, contentHTML: string): void`
- Purpose: Show the shared right drawer for detail views and forms.
- Behavior: Populate drawer title/body, open the drawer, and focus the first usable control.
- Parameters: Title text and prebuilt HTML.
- Return value: None.
- Error handling: If drawer DOM is missing, fail silently rather than breaking page rendering.

`closeDrawer(): void`
- Purpose: Close the shared drawer and restore background interaction.
- Behavior: Remove open state, clear focus state, and keep body scroll behavior sane.
- Parameters: None.
- Return value: None.
- Error handling: Safe no-op if the drawer is already closed.

[Changes]

Implement the refactor in a few small, dependency-ordered steps so the Newspaper stays stable throughout.

1. Create the shared section manifest and shell bootstrap modules first, because every section page and nav render will depend on them.
2. Add the data resolver next so all future page code can use the same live → GAS → localStorage → static fallback path.
3. Update `the_gates.js` to consume the manifest and expose the shared shell behavior without duplicating per-page assumptions.
4. Patch each section page to call the shared shell initializer and keep page-specific code only where the content actually differs.
5. Tighten section CSS files so shared styles stay in `the_broadsheet.css` and section files only hold section-specific accents and layout rules.
6. Verify the root redirect, all section URLs, drawer interactions, and auth gating still work with the new shared modules.
7. Update the service worker precache list and manifest if any new shared assets must be available offline.
8. Confirm the Newspaper remains bookmark-friendly and section URLs continue to load directly without an intermediate SPA router.
9. Validate the build output against the current church deployment process before considering the refactor complete.

Key technical decisions:
- Keep one section per URL; do not introduce client-side routing for the Newspaper itself.
- Use shared JS helpers for shell behavior instead of copying bootstrap code into every section.
- Keep data resolution explicit and sequential so the UI can always render a fallback.
- Treat the Newspaper as a document system with shared chrome, not as a single-page state machine.

[Tests]

Verify the refactor with both code-level checks and real browser validation.

- Unit-level checks for the shared manifest lookup and data resolver behavior.
- Integration checks for section nav rendering, auth visibility, and drawer open/close flows.
- Browser verification for every section URL loading directly from its own route.
- Mobile checks at 375px width to confirm no horizontal scrolling and no clipped text.
- Safe-area checks on iOS-like viewport conditions to confirm the masthead and controls stay visible.
- Offline checks after the first load to confirm the service worker still serves cached Newspaper assets.
- Build verification using `bash "Iris/Bezalel/Scripts/C-Build_Newspaper.sh"` from the workspace root.
- If any TypeScript is added, run `tsc --noEmit`; otherwise validate syntax and browser behavior on the touched JS files.
- Confirm the shared drawer still passes the usability checks for close button size, backdrop close, and escape key close.
- Confirm no section loses direct-link behavior as a result of the shared shell refactor.
