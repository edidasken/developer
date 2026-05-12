# New Covenant — As-Built Doc Set Index

This document serves as an index and guide to the as-built documentation for the FlockOS New Covenant application.

## Documentation Artifacts

The following documents provide an in-depth view of the New Covenant application's architecture and operation:

*   **Script Module Inventory**
    *   Documents all JavaScript modules, their purpose, and their interdependencies within the application.
    *   Filename: `Architechtural Docs/New Covenant/Architecture/G-AS-BUILT-Script-Module-Inventory.md`
*   **View Inventory**
    *   Catalogs all user interface views, their responsibilities, and the routes that trigger them.
    *   Filename: `Architechtural Docs/New Covenant/Architecture/H-AS-BUILT-View-Inventory.md`
*   **Data Layer Inventory**
    *   Describes the application's data structures, storage mechanisms, and interactions with Firebase Firestore.
    *   Filename: `Architechtural Docs/New Covenant/Architecture/I-AS-BUILT-Data-Layer-Inventory.md`
*   **Architecture Overview**
    *   Provides a high-level summary of the application's structure, components, and technology stack.
    *   Filename: `Architechtural Docs/New Covenant/Architecture/F-AS-BUILT-Architecture-Overview.md`
*   **Operations Guide**
    *   Details the procedures for deploying, monitoring, and maintaining the New Covenant application.
    *   Filename: `Architechtural Docs/New Covenant/Architecture/K-AS-BUILT-Operations-Guide.md`
*   **Doc Set Index** *(this file)*
    *   Filename: `Architechtural Docs/New Covenant/Architecture/J-AS-BUILT-Doc-Set-Index.md`

## How to Keep This Up to Date

To ensure the as-built documentation accurately reflects the current state of the New Covenant codebase, perform the following updates:

*   **When adding a new script module**:
    *   Update the `script-module-inventory.md` to include the new module in the table and ensure the dependency graph is accurate.
*   **When adding a new view or route**:
    *   Update the `view-inventory.md` to include the new view in the table and map its corresponding route.
*   **When modifying data structures or Firestore interactions**:
    *   Update the `data-layer-inventory.md` to reflect changes in data models or database operations.
*   **When adding a new deployment target or changing deployment procedures**:
    *   Update the `operations-runbook.md` with new hosting details, build steps, or monitoring configurations.
*   **When implementing significant architectural changes**:
    *   Review and update the `architecture-overview.md` to reflect high-level structural or technological shifts.

## Regeneration vs. Hand-Maintenance

Certain sections of this documentation can be largely regenerated from the source code, while others require manual authoring and maintenance:

*   **Regenerated from Source (AI Pass)**:
    *   `AS-BUILT-Script-Module-Inventory.md` (Table of modules and dependency graph)
    *   `AS-BUILT-View-Inventory.md` (Table of views and route map)
    *   `AS-BUILT-Data-Layer-Inventory.md` (Description of data models and Firestore interactions)
*   **Hand-Maintained**:
    *   `AS-BUILT-Architecture-Overview.md` (Requires high-level synthesis and descriptive text beyond what can be parsed from code)
    *   `AS-BUILT-Operations-Guide.md` (Details procedural steps, external services, and operational context not directly present in code)
