#!/bin/bash
set -e

DEPLOY_BRANCH="main"

echo "Building site from $DEPLOY_BRANCH..."
git stash --quiet --include-untracked 2>/dev/null || true
git checkout "$DEPLOY_BRANCH"

npx astro build

echo "Deploying to gh-pages..."
cd dist
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f git@github.com:angelday/jsch_web.git gh-pages
rm -rf .git
cd ..

git checkout - --quiet
git stash pop --quiet 2>/dev/null || true

echo "Done!"
