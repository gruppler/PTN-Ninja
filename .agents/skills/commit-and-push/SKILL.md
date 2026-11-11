---
name: commit-and-push
description: Commit and push changes, with the change's changelog entry shown for approval before it is committed. Use when asked to commit, push, or commit and push.
---

# Commit and Push

Create a well-formatted commit and push it to the remote.

## Steps

1. **Check status**

   - Run `git status` to see what's changed.
   - Run `git diff --stat` for a summary.

2. **Changelog entry**

   - If people using the app will notice the change, it needs an entry file in
     `changelog/unreleased/` (format in its README). Add one named after the
     change or branch, unless one already covers it. One file can list several
     changes.
   - Not every commit needs one. A fix to something not yet released needs
     none; if it changes what that feature does, edit the feature's entry
     instead.
   - Tests, CI, refactors, docs and fixes to unreleased work need none. On a
     PR, label it `no-changelog`.
   - Never edit `src/changelog.json` or the `package.json` version here;
     `yarn changelog:collect` does that at release time.

3. **Review gate: STOP until the user approves the entry.**

   - Show the proposed entry in full before committing anything: the file
     name, `bump`, every change's `type` and `description` exactly as written,
     and any `deploy` steps. If you edited an existing entry, show the whole
     file and say what changed.
   - Say why you chose the `bump`, and flag any wording you were unsure of.
   - If no entry is needed, say so and why, and get the user's OK on that too.
   - Apply the user's edits, run `yarn changelog:check`, and show the entry
     again. Repeat until the user approves it.
   - Do not commit until the entry is approved. If the user wants the code
     committed meanwhile, commit it without the entry file, and commit the
     entry once it is approved.

4. **Format modified files**

   - Run `npx prettier --write` on the modified `.vue`, `.js`, `.mjs`,
     `.json` and `.md` files, including the entry file.

5. **Stage changes**

   - Stage the files that belong to this change, including its entry file.
     Check `git status` for unrelated changes (another session may be working
     in this checkout) and leave them unstaged.

6. **Commit**

   - Write a message whose subject says what changed in plain words, under
     72 characters, matching the style of `git log --oneline`. Use the body
     for why, and for any step whoever deploys must run.
   - Don't add a `Co-Authored-By` trailer.

7. **Push**
   - Run `git push origin HEAD`.
   - If the push fails because of upstream changes, offer to pull and rebase.
