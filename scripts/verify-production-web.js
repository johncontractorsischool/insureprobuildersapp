#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const productionUrl = 'https://api.ams.insureprobuilders.com';
const localUrl = 'http://localhost:4000';
let foundProductionUrl = false;

function verifyDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      verifyDirectory(filePath);
    } else if (entry.isFile()) {
      const contents = fs.readFileSync(filePath);
      if (contents.includes(localUrl)) {
        throw new Error(`Production web bundle still contains ${localUrl} in ${filePath}`);
      }
      if (contents.includes(productionUrl)) {
        foundProductionUrl = true;
      }
    }
  }
}

try {
  verifyDirectory(path.resolve('dist'));
  if (!foundProductionUrl) {
    throw new Error('Production web bundle is missing the AMS-PBIA production URL');
  }
  console.log('Production web bundle verified: AMS-PBIA production URL is present');
} catch (error) {
  console.error(`Production web verification failed: ${error.message}`);
  process.exitCode = 1;
}
