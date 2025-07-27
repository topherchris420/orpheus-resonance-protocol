#!/bin/bash
echo "Building bio-acoustic modulation app..."
npx vite build --config vite.config.ts
echo "Build completed. Files created in dist/public/"
ls -la dist/public/