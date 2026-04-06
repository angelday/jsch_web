#!/bin/bash
set -e

echo "Building site..."
npx astro build

echo "Deploying to gh-pages..."
cd dist
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f git@github.com:angelday/jsch_web.git gh-pages
rm -rf .git

echo "Done! Site will be live at https://angelday.github.io/jsch_web/"
