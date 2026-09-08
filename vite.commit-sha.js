import { execSync } from 'node:child_process'

/**
 * Reads the current commit SHA at build time, for the footer's "verify what you're running"
 * link. Shared between `vite.config.js` and the future single-file config (build-order stage
 * 10) so both build targets stamp the same value the same way.
 *
 * `git rev-parse HEAD` works from a shallow checkout too — GitHub Actions' default
 * `fetch-depth: 1` limits how much *history* is available, not whether the checked-out
 * commit's own SHA can be read. Falls back to `'unknown'` for a build run outside a git
 * checkout at all (e.g. from a downloaded source archive) rather than failing the build over a
 * footer link.
 */
export function getCommitSha() {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}
