#!/usr/bin/env node

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔐 Generating encryption key for MediaNest...\n');

// Generate a secure random key
const key = crypto.randomBytes(32).toString('hex');

// Path to .env file
const envPath = path.join(__dirname, '../../.env');

// Check if .env file exists
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// Check if ENCRYPTION_KEY already exists
if (envContent.includes('ENCRYPTION_KEY=')) {
  console.log('⚠️  ENCRYPTION_KEY already exists in .env file');
  console.log('To generate a new key, remove the existing ENCRYPTION_KEY line from .env first');
  process.exit(1);
}

// Append the key to .env file
const newLine = envContent.endsWith('\n') ? '' : '\n';
fs.appendFileSync(envPath, `${newLine}ENCRYPTION_KEY=${key}\n`);

console.log('✅ Encryption key generated and saved to .env file');
console.log('\n🔒 Key (64 characters):', key);
console.log('\n⚠️  IMPORTANT:');
console.log('1. Keep this key secure and never commit it to version control');
console.log('2. Back up this key - losing it means losing access to encrypted data');
console.log('3. Use the same key across all application instances');
console.log('4. Restart the application for the new key to take effect');