#!/bin/sh
set -e

echo "CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-<empty>}"
echo "PWD before: $(pwd)"

# Go to the root of the cloned repository
cd "$CI_PRIMARY_REPOSITORY_PATH"

# If your app is in a subfolder called "hermes"
cd hermes

echo "PWD after cd: $(pwd)"
ls -la

# Install JS deps
npm ci

# Install CocoaPods deps (generates the Pods-*.xcconfig files)
cd ios
pod install

echo "✅ ci_post_clone complete"
exit 0