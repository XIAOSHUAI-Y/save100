#!/usr/bin/env bash
# 部署到 GitHub Pages：构建 -> 把 dist 推到 gh-pages 分支
#
# 用法：npm run deploy
# 说明：GitHub Pages 从 gh-pages 分支根目录发布，地址 https://xiaoshuai-y.github.io/save100/
set -euo pipefail

REMOTE="${DEPLOY_REMOTE:-git@github.com:XIAOSHUAI-Y/save100.git}"
BRANCH=gh-pages
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

cd "$ROOT"
npm run build

BUILD_ID="$(node -e "console.log(require('./dist/version.json').buildId)")"
echo "buildId: $BUILD_ID"

cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"

cd "$TMP"
git init -b "$BRANCH" -q
git add -A
git commit -q -m "deploy $BUILD_ID"
git remote add origin "$REMOTE"
git push -f origin "$BRANCH"

echo "已推送 gh-pages（$BUILD_ID），等 GitHub Pages 重建约 30 秒"
echo "https://xiaoshuai-y.github.io/save100/"
