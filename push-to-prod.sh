#!/bin/bash

TEMPFILE='.tmp-message'

if [[ $# -lt 1 ]]; then
  echo 1>&2 "$0: Missing version number (currently '$(git describe --tags $(git rev-list --tags --max-count=1))')"
  exit 2
fi

if [[ $1 = v* ]]; then
  version="$1"
else
  version="v$1"
fi

pause () {
  read -rsp $'Press any key to continue...\n' -n1 key
}

# Dump all commit messages since last tag
if [[ ! -f $TEMPFILE ]]; then
  echo "$version" > $TEMPFILE
  echo >> $TEMPFILE
  git log `git describe --tags $(git rev-list --tags --max-count=1)`..HEAD \
  | grep -Ev '^(\S|\s*$)' | sed 's/^\s*//' \
  >> $TEMPFILE
fi

# Open the editor
"${EDITOR:-vim}" $TEMPFILE

echo "$0: Switching to master"
pause
git checkout master
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to switch to master branch"
  exit 1
fi

echo "$0: Merging development"
git merge development
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to merge development into master"
  exit 1
fi

echo "$0: Building"
r.js -o app.build.js
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to build"
  exit 1
fi

echo "$0: Converting CRLF to LF"
find ./ -type f -exec dos2unix {} \;

echo "$0: Committing"
git commit -a -F="$TEMPFILE"
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to commit"
  exit 1
fi

echo "$0: Tagging"
git tag -a "$version" -F $TEMPFILE
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to tag"
  exit 1
fi

echo "$0: Pushing tagged commit"
pause
git push origin --follow-tags
if [[ $? -ne 0 ]]; then
  echo 1>&2 "$0: Failed to push tagged commit"
  exit 1
fi

echo "$0: Pushing build to production"
pause
git subtree push --prefix dist origin gh-pages
if [[ $? -ne 0 ]]; then
  read -p "$0: Failed! Try forcing it? [Y|n] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$|^$ ]]; then
    echo 1>&2 "$0: Failed to push build to production"
    exit 1
  fi

  echo "$0: Force-pushing build to production"
  git push origin `git subtree split --prefix dist master`:gh-pages --force
  if [[ $? -ne 0 ]]; then
    echo 1>&2 "$0: Failed to force-push build to production"
    exit 1
  fi
fi

rm $TEMPFILE
