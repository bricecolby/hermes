#!/bin/sh
set -e

echo "CI_WORKSPACE=$CI_WORKSPACE"
cd "$CI_WORKSPACE"

# Your app lives in the "hermes" subfolder (per your build log paths)
cd hermes

# Install JS deps
npm ci

# Install Pods (generates Pods-*.xcconfig that your build is missing)
cd ios
pod install