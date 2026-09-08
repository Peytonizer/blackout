import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { getCommitSha } from './vite.commit-sha.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Stamps the build's commit SHA into the footer link — see vite.commit-sha.js.
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(getCommitSha()),
  },
  test: {
    // No test files exist yet at build-order stage 1 (they land from stage 3 onward, alongside
    // core/marks.js et al.) — without this, `vitest run` treats an empty suite as a failure.
    passWithNoTests: true,
  },
})
