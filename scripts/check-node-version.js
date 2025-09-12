#!/usr/bin/env node

const { engines } = require('../package.json');

const currentVersion = process.version;
const requiredVersion = engines.node;

const versionMatch = requiredVersion.match(/>=(\d+)\.(\d+)\.(\d+)/);
if (!versionMatch) {
  console.error('Invalid engine version format in package.json');
  process.exit(1);
}

const [, reqMajor, reqMinor] = versionMatch;
const [curMajor, curMinor] = currentVersion.slice(1).split('.').map(Number);

if (curMajor < Number(reqMajor) || (curMajor === Number(reqMajor) && curMinor < Number(reqMinor))) {
  console.error(`Node.js version ${requiredVersion} is required. You are using ${currentVersion}`);
  console.error('Please use nvm or another Node version manager to switch to the correct version.');
  process.exit(1);
}

console.log(`✓ Node.js version ${currentVersion} meets requirement ${requiredVersion}`);
