#!/usr/bin/env node

// Simple script to output just the version from package.json
// No extra output, no npm/pnpm noise

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json');

console.log(version);

