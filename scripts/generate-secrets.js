#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function main() {
  console.log('🔐 Generating secrets for MediaNest...\n');

  const secrets = {
    NEXTAUTH_SECRET: generateSecret(),
    ENCRYPTION_KEY: generateSecret(),
  };

  console.log('Add these to your .env file:\n');
  console.log(`NEXTAUTH_SECRET=${secrets.NEXTAUTH_SECRET}`);
  console.log(`ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`);

  // Create secrets directory if it doesn't exist
  const secretsDir = path.join(__dirname, '..', 'secrets');
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
  }

  // Write secrets to files for Docker
  fs.writeFileSync(path.join(secretsDir, 'nextauth_secret'), secrets.NEXTAUTH_SECRET);
  fs.writeFileSync(path.join(secretsDir, 'encryption_key'), secrets.ENCRYPTION_KEY);
  fs.writeFileSync(path.join(secretsDir, 'db_password'), 'medianest_password');

  console.log('\n✅ Secrets generated and saved to secrets/ directory');
  console.log('\n⚠️  Remember to:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Add the generated secrets to your .env file');
  console.log('3. Get your Plex OAuth credentials from https://www.plex.tv/api/v2/pins');
  console.log('4. Never commit the .env file or secrets/ directory to version control');
}

main();