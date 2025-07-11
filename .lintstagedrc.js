/**
 * @type {import('lint-staged').Config}
 */
const path = require('path')

// Build Next.js ESLint command as recommended in docs
const buildNextEslintCommand = (filenames) => {
  const cwd = process.cwd()
  return `cd frontend && npx next lint --fix --file ${filenames
    .map((f) => path.relative(path.join(cwd, 'frontend'), f))
    .join(' --file ')}`
}

module.exports = {
  // Frontend files - use Next.js ESLint integration
  'frontend/**/*.{js,jsx,ts,tsx}': [buildNextEslintCommand, 'prettier --write'],

  // Backend TypeScript files
  'backend/**/*.ts': [
    'npx eslint --fix',
    'prettier --write'
  ],

  // Shared package TypeScript files
  'shared/**/*.ts': [
    'npx eslint --fix',
    'prettier --write'
  ],

  // JSON files (excluding package-lock.json)
  '**/*.json': (files) => {
    const filtered = files.filter(file => !file.includes('package-lock.json'))
    return filtered.length ? [`prettier --write ${filtered.join(' ')}`] : []
  },

  // Markdown files
  '**/*.md': 'prettier --write',

  // YAML files
  '**/*.{yml,yaml}': 'prettier --write',

  // Prisma schema files
  'backend/prisma/schema.prisma': 'cd backend && npx prisma format',

  // CSS files - if any exist
  '**/*.css': 'prettier --write',

  // Shell scripts - ensure they're executable
  '**/*.sh': (files) => files.map(file => `chmod +x ${file}`)
}