# Project Rules

## Vuex Pattern

Never attach vue listeners to a Game object directly, and never mutate a game directly. We must use the vuex output to read from the game, and vuex actions/mutations to mutate the game.

## i18n Strings

When inserting new i18n strings, put them in the appropriate category if one exists, and insert them in alphabetical order.

## Changelog Entries

Every change people using the app will notice brings its own changelog entry:
a JSON file in `changelog/unreleased/` added in the same commit. The format and
rules are in `changelog/unreleased/README.md`. A release collects the waiting
entries into `src/changelog.json` (`yarn changelog:collect`), so never edit
`src/changelog.json` or the `package.json` version alongside a change.

- **Write it with the change**, in plain language, with a `bump` (`patch`
  unless the change is a new capability). One file lists as many changes as
  the work needs.
- **Not every commit needs an entry.** A fix to an unreleased change needs
  none; if it changes what that feature does, edit the feature's entry instead.
- **No user-facing change** (tests, CI, refactors, docs): no file.

## Formatting

Always run `npx prettier --write` on the files you've modified.
