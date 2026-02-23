#!/bin/sh
set -e

echo "CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-<empty>}"
echo "PWD before: $(pwd)"

cd "$CI_PRIMARY_REPOSITORY_PATH"
cd hermes

echo "PWD after cd: $(pwd)"

# ---- Ensure Node/npm exists ----
HOMEBREW_NO_AUTO_UPDATE=1
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found. Installing via Homebrew..."
  brew install node
fi

echo "node: $(node -v)"
echo "npm:  $(npm -v)"

# Install JS deps
npm ci

# Pods
cd ios
pod install

echo "✅ ci_post_clone complete"