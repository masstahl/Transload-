# Transload Log UI checks

This repository is a static GitHub Pages app. `lintapple` is configured to audit the live production URL without changing app data or runtime behavior.

## Requirements

- Node.js 22 or newer
- npm

## Run the audit

```sh
npm install
npm run lint:ui
```

The audit checks the app at mobile (390×844) and desktop (1440×900) sizes. Rules are in `ui-policy.json`; they reflect the app's system-font stack and existing type scale. Adjust those rules deliberately when the design system changes.

To audit another URL or get machine-readable output:

```sh
npx lintapple https://masstahl.github.io/Transload-/ --json
```

Exit codes: `0` means passed, `1` means findings were reported, and `2` means the audit could not complete. The audit itself is read-only; it does not modify the app or its database.
