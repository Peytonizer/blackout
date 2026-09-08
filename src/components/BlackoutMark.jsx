/**
 * The wordmark icon: a black mark with its accent-red outline, echoing exactly what a
 * redaction looks like in the editor (SPEC.md's "Visual design" — black fill with a red
 * outline is what makes a mark findable against dark chrome). Matches `public/favicon.svg`.
 */
export default function BlackoutMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="8" width="16" height="8" rx="1" fill="#000000" stroke="#d1293d" strokeWidth="1.6" />
    </svg>
  )
}
