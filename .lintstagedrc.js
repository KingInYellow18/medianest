/**
 * @type {import('lint-staged').Config}
 */
module.exports = {
  // Frontend files - use Next.js ESLint integration
  'frontend/**/*.{js,jsx,ts,tsx}': [
    'prettier --write'
  ],

  // Backend TypeScript files
  'backend/**/*.ts': [
    'prettier --write'
  ],

  // Shared package TypeScript files
  'shared/**/*.ts': [
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