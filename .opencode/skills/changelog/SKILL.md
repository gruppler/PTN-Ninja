---
name: changelog
description: Draft and apply an in-app changelog release with LLM assistance
---

Use this to add a new "What's New" changelog release and ship it. The whole
loop is file-based: draft to `changelog.draft.json`, PAUSE for the user to
review the draft, then apply and release (commit, merge to master, tag, push,
publish the GitHub release) in one go — do NOT pause again after the draft is
confirmed.

Branch policy: releases are ALWAYS cut from `dev`. The release commit lands on
`dev`, which is merged `--no-ff` into `master`, tagged `vX.Y.Z`, and `dev` is
fast-forwarded back to `master`. If the current branch is not `dev`, stop
before the release step and ask the user to merge their work into `dev` first
— do NOT run the release step from a feature branch.

1. Print the prompt to see the schema and recent commits since the last
   release.
   // turbo
2. Run `yarn changelog:prompt`.

3. Check for an existing draft at `changelog.draft.json` (repository root,
   gitignored). If it exists, it is likely left over from a previous run of
   this workflow that was never completed, and more commits may have landed
   since it was written. RECONCILE it instead of starting from scratch:

   - KEEP entries that still correspond to commits listed in the prompt
     output — preserve the existing wording and `type` as-is. These may
     reflect the user's own edits; do not reword them.
   - DROP entries that no longer match any unreleased commit (stale: already
     released, reverted, or superseded). Do not preserve stale entries.
   - ADD entries for unreleased commits the draft doesn't cover yet.
   - Re-evaluate the `version` bump against the full reconciled set of
     changes — new commits may warrant a larger (or smaller) bump than the
     existing draft has.

4. Draft the release as a JSON object that matches the schema from step 2.
   Follow the prompt's rules:

   - Set `version` explicitly, choosing the bump by IMPACT, not category:
     patch for fixes AND small refinements to existing features (when in
     doubt, patch); minor only for substantial new capabilities a user would
     notice as something new; major for breaking changes.
   - Order changes by impact: `added`, then `changed`, then `fixed` (place
     `removed` where it fits). Higher-impact items first within each group.
   - Change descriptions should include punctuation.
   - Output STRICTLY VALID JSON. Do NOT put raw double-quotes inside a
     `description`; use single quotes (`'New Address'`) or curly quotes.

5. Write the drafted JSON to `changelog.draft.json` at the repository root
   (overwriting the previous draft if one existed).

6. Draft review gate — STOP here until the user confirms. Show the user the
   full draft. If you reconciled a pre-existing draft, also summarize what
   you kept, what you dropped as stale, and what you added, so the user can
   verify nothing was lost. If the user requests changes (including a
   different version bump), edit `changelog.draft.json` and re-present it.
   Do NOT proceed past this step until the user explicitly confirms the
   draft. Once confirmed, do NOT pause again — continue straight through
   apply, release, and confirmation.

7. Apply the draft. This inserts/replaces the release in `src/changelog.json`
   (matching versions replace, never duplicate), bumps `version` in
   `package.json`, formats `src/changelog.json` with prettier, and then
   deletes `changelog.draft.json`. (Add `--keep` to retain the draft while
   iterating.) If the version needs to change after applying, run
   `yarn changelog:version x.y.z` — it retargets the latest release and syncs
   both files at once; do NOT edit the version by hand in both files. If you
   edit `src/changelog.json` by hand, run
   `npx prettier --write src/changelog.json` afterward.
   // turbo
8. Run `yarn changelog:apply`.

9. Verify the applied release.
   // turbo
10. Run `yarn changelog --show`.

11. Release. This commits `src/changelog.json` + `package.json` together on
    `dev`, merges `dev` into `master` as `vX.Y.Z` with the simplified
    changelog (every change as a bullet) as the merge commit body, tags
    `vX.Y.Z` on the merge commit, fast-forwards `dev` to `master`, pushes
    both branches plus the tag to origin, and publishes the GitHub release
    with those same bullets and a compare link to the previous release.
    Append `--dry-run` to preview the steps without running them, or
    `--no-push` to keep everything local (which also skips the GitHub
    release, since it needs the pushed tag).
    // turbo
12. Run `yarn changelog:release`.

13. Confirm the result.
    // turbo
14. Run `git log --oneline -3 && git tag --sort=-creatordate | head -3 && gh release view v<version>`.
