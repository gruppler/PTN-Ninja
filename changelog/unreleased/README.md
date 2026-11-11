# Changelog entries

Every change that people using the app will notice brings its own entry here:
a JSON file added in the same commit (or the same PR). Not every commit needs
one, and one file can list several changes. At release time
`yarn changelog:collect` combines the waiting entries into one release in
`src/changelog.json` (what the in-app What's New dialog shows), bumps
`package.json`, and deletes the files.

Nobody edits `src/changelog.json` or the version alongside a change, so two
branches never conflict over them.

## Format

Name the file after the change or its branch, e.g. `engine-drag-reorder.json`:

```json
{
  "bump": "minor",
  "changes": [
    {
      "type": "added",
      "description": "Drag engines in Settings to reorder them."
    }
  ],
  "deploy": "Deploy the functions too: yarn deploy:functions"
}
```

- `bump`: `patch` for fixes and small refinements (the default when unsure),
  `minor` for a capability people will notice as new, `major` for breaking
  changes. The release takes the largest bump among its entries.
- `changes`: one item per line users will read in What's New, as many as the
  work needs, with the same fields as `src/changelog.json`.
  - `type`: `added`, `changed`, `fixed` or `removed`.
  - `description`: the change in plain language, not code. No raw double
    quotes: use 'single' or “curly” quotes.
- `deploy` (optional): a sentence, or a list of them, for whoever deploys:
  steps beyond the hosting deploy (deploy the functions, rebuild a wasm
  bundle). Printed at collect time, never shown to users.

## Rules

- **Not every commit needs an entry.** A fix to something not yet released
  needs none: users never saw the bug, so the release only describes the
  finished feature. If the fix changes what the feature does, edit that
  feature's entry instead of adding one.
- **One change can need several lines**: list them all in its file's
  `changes`, or add more than one file.
- **No user-facing change** (tests, CI, refactors, docs): no file. On a PR,
  label it `no-changelog`.
- **The PR check** (`.github/workflows/changelog.yml`) fails a PR into `dev`
  that brings no entry and has no `no-changelog` label. It also validates every
  file here, on PRs and on pushes to `dev` that touch them.

## Commands

- `yarn changelog:unreleased`: preview the next release, and list the PRs and
  direct commits since the last release that brought no entry, to check at
  release time. Most of those need none.
- `yarn changelog:prompt`: with entries waiting, prints an LLM prompt that
  drafts one more entry covering only the commits they miss.
- `yarn changelog:check`: validate every entry file.
- `yarn changelog:collect`: write the release and delete the entries
  (`--dry-run` to preview, `--version x.y.z` to pin the number). To redo it,
  restore the files first:
  `git checkout -- src/changelog.json package.json changelog/unreleased`.
- `yarn changelog:release`: commit, merge `dev` into `main`, tag, push, and
  publish the GitHub release. It refuses while entries are still waiting.
