# Transload Log UI checks

This repository is a static GitHub Pages app. GitHub Actions serves the exact checked-out commit locally and audits that copy with `lintapple`; it does not depend on the production site having deployed first. The audit is read-only and does not modify app data or the database.

## Requirements

- Node.js 22 or newer
- npm
- Python 3 (for the local static server used by CI)

## Run the audit

To audit the live production app locally:

```sh
npm install
npm run lint:ui
```

To audit the checked-out source instead, serve the repository root and set `UI_AUDIT_URL` to that local URL before running `npm run lint:ui`. The workflow does this automatically.

The audit checks mobile (390×844) and desktop (1440×900) sizes. Rules are in `ui-policy.json`; they reflect the app's system-font stack, existing type scale, and compact 5px minimum spacing for adjacent controls. Small utility buttons are allowed by the button type rule, but contrast and accessible-name checks still apply. Adjust policy rules deliberately when the design system changes.

To audit another URL or get machine-readable output:

```sh
npx lintapple https://masstahl.github.io/Transload-/ --json
```

Exit codes: `0` means passed, `1` means findings were reported, and `2` means the audit could not complete. Fix findings in a pull request and review them before merging to production.
