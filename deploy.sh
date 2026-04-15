#!/bin/bash
set -e

DEPLOY_BRANCH="main"

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$DEPLOY_BRANCH" ]; then
  echo "Error: must be on '$DEPLOY_BRANCH' to deploy (currently on '$current_branch')."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is dirty. Commit or stash your changes before deploying."
  git status --short
  exit 1
fi

DEPLOY_REMOTE="${DEPLOY_REMOTE:-}"
if [ -z "$DEPLOY_REMOTE" ]; then
  DEPLOY_REMOTE=$(git config --get remote.origin.pushurl || git config --get remote.origin.url)
fi

if [ -z "$DEPLOY_REMOTE" ]; then
  echo "Error: could not determine deploy remote. Set DEPLOY_REMOTE or configure origin."
  exit 1
fi

echo "Building site from $DEPLOY_BRANCH..."

npx astro build

echo "Deploying to gh-pages..."
cd dist
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f "$DEPLOY_REMOTE" gh-pages
rm -rf .git
cd ..

echo "Done!"
