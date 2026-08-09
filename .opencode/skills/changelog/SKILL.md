---
name: changelog
description: Draft and apply an in-app changelog release with LLM assistance
---

Use this to add a new "What's New" changelog release and ship it. The whole
loop is file-based: draft to `changelog.draft.json`, apply, review with the
user, then release (commit, merge to main, tag, push).

Branch policy: releases are ALWAYS cut from `dev`. The release commit lands on
`dev`, which is merged `--no-ff` into `main`, tagged `vX.Y.Z`, and `dev` is
fast-forwarded back to `main`. If the current branch is not `dev`, stop after
step 6 and ask the user to merge their work into `dev` first — do NOT run the
release step from a feature branch.

1. Print the prompt to see the schema and recent commits since the last release.
   // turbo
2. Run `yarn changelog:prompt`.

3. Draft the release as a JSON object that matches the schema from step 2.
   Follow the prompt's rules:

   - Set `version` explicitly, choosing the bump by IMPACT, not category:
     patch for fixes AND small refinements to existing features (when in
     doubt, patch); minor only for substantial new capabilities a user would
     notice as something new; major for breaking changes.
   - Order changes by impact: `added`, then `changed`, then `fixed` (place
     `removed` where it fits). Higher-impact items first within each group.
   - Output STRICTLY VALID JSON. Do NOT put raw double-quotes inside a
     `description`; use single quotes (`'New Address'`) or curly quotes.

4. Write the drafted JSON to `changelog.draft.json` at the repository root
   (this path is gitignored).

5. Apply the draft. This inserts/replaces the release in `src/changelog.json`,
   bumps `version` in `package.json`, formats `src/changelog.json` with
   prettier, and then deletes `changelog.draft.json`. (Add `--keep` to retain
   the draft while iterating.)
6. Run `yarn changelog:apply`.

7. Review gate — STOP here until the user confirms.
   // turbo
8. Run `yarn changelog --show`.

9. Show the user the new release entry (and the `git diff` for
   `src/changelog.json` + `package.json`) and ask them to review it. If the
   user wants a different version bump (e.g. downgrade minor → patch), run
   `yarn changelog:version x.y.z` — it retargets the latest release and syncs
   both files at once; do NOT edit the version by hand in both files. For
   wording changes, the user may edit `src/changelog.json` directly, or ask
   you to tweak it — re-draft with the SAME `version` and re-apply (matching
   versions replace, never
   duplicate). If you edit `src/changelog.json` by hand, run
   `npx prettier --write src/changelog.json` afterward. Do NOT proceed past
   this step until the user explicitly confirms the changelog.

10. Release. This commits `src/changelog.json` + `package.json` together on
    `dev`, merges `dev` into `main` with the simplified changelog (every change
    as a bullet) as the merge commit body, tags `vX.Y.Z` on the merge commit,
    fast-forwards `dev` to `main`, and pushes both branches plus the tag to
    origin. Append `--dry-run` to preview the git steps without running them,
    or `--no-push` to keep everything local.
    // turbo
11. Run `yarn changelog:release`.

12. Confirm the result.
    // turbo
13. Run `git log --oneline -3 && git tag --sort=-creatordate | head -3`.
