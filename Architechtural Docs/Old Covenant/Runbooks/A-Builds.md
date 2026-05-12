# FlockOS Builds

Edit this document to control the deployment cards rendered on FlockOS_Churches.html. Note for COPILOT: Do not modify this file without first discussing it with the developer.

Format rules:
- Use `## Root` once for the master build.
- Use `## Deployment` once per church build.
- Under each section, keep each field on its own line using `- key: value`.
- Supported keys are `name`, `short`, `href`, `image`, `alt`, `description`, and `badge`.

## Root
- name: FlockOS
- short: Master Build
- href: Covenant/Gate/SuiteGate/index.html
- image: Covenant/Courts/TheTabernacle/Images/FlockOS_AppIcon.png
- alt: FlockOS
- description: The root source deployment and single source of truth for every church release.
- badge: Open Master Build

## Deployment
- name: FlockOS Demo
- short: Demo
- href: Covenant/Nations/FlockOS/FlockOS/Pages/index.html
- image: Covenant/Courts/TheTabernacle/Images/FlockOS_Pink.png
- alt: FlockOS Demo
- description: This is the base deployment for testing FlockOS in a flexible, general church setting.
- badge: Open Deployment

## Deployment
- name: The Wellspring
- short: GAS Deployment
- href: Covenant/Nations/GAS/FlockOS/Pages/index.html
- image: Covenant/Courts/TheTabernacle/Images/FlockOS_Orange.png
- alt: The Wellspring
- description: This is the base deployment tailored for testing the offline features via the "Wellspring."
- badge: Open Deployment

## Deployment
- name: Trinity Baptist
- short: TBC-Indio
- href: Covenant/Nations/TBC/FlockOS/Pages/index.html
- image: Covenant/Courts/TheTabernacle/Images/FlockOS_Blue.png
- alt: Trinity Baptist Church
- description: Deployment configured for Trinity Baptist and its local church and ministry work.
- badge: Open Deployment

## Deployment
- name: The Forest
- short: The Forest
- href: Covenant/Nations/TheForest/FlockOS/Pages/index.html
- image: Covenant/Courts/TheTabernacle/Images/FlockOS_Green.png
- alt: The Forest
- description: Deployment shaped for The Forest and its local church and shared build branch.
- badge: Open Deployment
