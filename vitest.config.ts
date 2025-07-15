import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      // Global coverage configuration
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportOnFailure: true,
      clean: true,
      cleanOnRerun: true,
      skipFull: false,
      // Merge coverage from all workspaces
      merge: true
    }
  }
})