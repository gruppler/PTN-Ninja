---
name: changelog
description: Collect the waiting changelog entries into an in-app What's New release and ship it
---

Use this to cut a "What's New" release and ship it. Each change brings its own
entry file in `changelog/unreleased/` (see its README), so a release collects
those files, catching up on anything that came without one, then PAUSES once
for the user to approve the release before it is written and shipped. Once
approved, do NOT pause again.

Branch policy: releases are ALWAYS cut from `dev`. The release commit lands on
`dev`, which is merged `--no-ff` into `main` as `vX.Y.Z`, tagged `vX.Y.Z`, and
`dev` is fast-forwarded back to `main`. If the current branch is not `dev`,
stop before the release step and ask the user to merge their work into `dev`
first. Do NOT run the release step from a feature branch.

1. See what's waiting and what landed without an entry.
   // turbo
2. Run `yarn changelog:unreleased`.

3. Catch up. For the listed commits and PRs that brought no entry, decide which
   ones people using the app will notice. Most need none (fixes to unreleased
   work, tests, chores, docs). If some do:

   - Run `yarn changelog:prompt`, which prints the schema, the entries already
     waiting, and the commits since the last release.
   - Write one entry file in `changelog/unreleased/` (for example
     `catch-up-YYYY-MM-DD.json`) covering only what the waiting entries miss.
     Do not repeat or reword the waiting entries; they were approved with
     their changes.
   - Choose its `bump` by IMPACT, not category: patch for fixes AND small
     refinements (when in doubt, patch); minor only for substantial new
     capabilities a user would notice as something new; major for breaking
     changes.
   - Descriptions are plain language with punctuation. No raw double quotes
     inside a `description`; use single quotes or curly quotes.

4. Preview the release.
   // turbo
5. Run `yarn changelog:check && yarn changelog:collect --dry-run`.

6. Release review gate: STOP here until the user confirms. Show the version,
   every change line, any deploy steps, and the full text of any catch-up
   entry you wrote, saying which commits it covers and which you left out and
   why. If the user asks for changes, edit the entry files (or pin the number
   with `--version x.y.z` in the next step) and show the preview again. Do NOT
   proceed until the user explicitly confirms. Once confirmed, do NOT pause
   again: continue straight through collect, release and confirmation.

7. Collect. This writes the release into `src/changelog.json`, bumps
   `version` in `package.json`, formats `src/changelog.json` with prettier,
   and deletes the entry files. To redo it, restore them first:
   `git checkout -- src/changelog.json package.json changelog/unreleased`.
   // turbo
8. Run `yarn changelog:collect`.

9. Verify the collected release.
   // turbo
10. Run `yarn changelog:show`.

11. Do any deploy steps the collect printed, or tell the user about them.

12. Release. This commits `src/changelog.json`, `package.json` and the
    deleted entry files together on `dev`, merges `dev` into `main` as
    `vX.Y.Z` with every change as a bullet in the merge commit body, tags it,
    fast-forwards `dev` to `main`, pushes both branches plus the tag, and
    publishes the GitHub release with the same bullets and a compare link.
    Pushing `main` and `dev` also deploys them through
    `.github/workflows/deploy.yml`. Append `--dry-run` to preview, or
    `--no-push` to keep everything local (which also skips the GitHub release).
    // turbo
13. Run `yarn changelog:release`.

14. Confirm the result.
    // turbo
15. Run `git log --oneline -3 && git tag --sort=-creatordate | head -3 && gh release view v<version>`.
