#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Fixing import order issues...\n');

const workspaces = ['frontend', 'backend', 'shared'];

for (const workspace of workspaces) {
  console.log(`📦 Fixing imports in ${workspace}...`);

  try {
    const workspacePath = path.join(process.cwd(), workspace);
    execSync(
      `npx eslint --fix --ext .ts,.tsx --rule "import/order: error" "${workspacePath}/src"`,
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      },
    );
    console.log(`✅ Fixed imports in ${workspace}\n`);
  } catch (error) {
    console.log(`⚠️  Some issues in ${workspace} may require manual fixing\n`);
  }
}

console.log('✨ Import fixing complete!');
