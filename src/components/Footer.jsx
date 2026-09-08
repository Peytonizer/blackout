// Baked in at build time by vite.commit-sha.js — see that file for why 'unknown' is possible.
const commitSha = import.meta.env.VITE_COMMIT_SHA

/**
 * The noradz footer, reduced to its one line — identical in spirit to Scrubber's, since both
 * apps make the same "nothing here leaves the page" claim.
 *
 * The commit link is the one outbound link Blackout ships — everything else in the app is
 * deliberately dead-ended by the CSP. It exists so a sceptical user can confirm the page
 * they're looking at was actually built from the source they audited, rather than take that on
 * trust too. `target="_blank"` is deliberate, not decorative: there is no persistence
 * (SPEC.md), so a footer link must never navigate the tab away and risk the loaded document.
 */
export default function Footer() {
  return (
    <footer className="border-t border-border px-8 py-8 max-[900px]:px-8 min-[901px]:px-[72px]">
      <p className="m-0 font-mono text-[11px] tracking-[0.08em] text-text-faintest">
        nothing here leaves the page
        {commitSha && commitSha !== 'unknown' && (
          <>
            {' · '}
            <a
              href={`https://github.com/Peytonizer/blackout/commit/${commitSha}`}
              target="_blank"
              rel="noreferrer"
              className="text-text-faintest underline decoration-border-soft underline-offset-2 hover:text-text-faint hover:decoration-text-faint"
            >
              built from commit {commitSha.slice(0, 7)}
            </a>
          </>
        )}
      </p>
    </footer>
  )
}
