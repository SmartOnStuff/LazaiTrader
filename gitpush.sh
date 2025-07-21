#!/bin/bash

# Load environment variables from .env
source .env
# Add everything
git add .
git commit -m "Complete push from local instance"
# Forced push to overwrite remote changes
git push --force https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@${GITHUB_REPO} main
done
