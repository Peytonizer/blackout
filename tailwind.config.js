/**
 * Tailwind config for the noradz "Signal" theme.
 *
 * Every colour Blackout uses is a token defined here, once, so there is exactly one place to
 * change a value. Components reference the semantic names (`bg-surface`, `text-muted`,
 * `border-border`) rather than hex codes. Values are copied from the reconciled Scrubber
 * config (`~/git/scrubber/tailwind.config.js`) — see SPEC.md's "Visual design" section for the
 * full rationale, including why `text-faint`/`text-faintest` diverge from the canonical noradz
 * values. Scrubber's `category` hues aren't carried over: Blackout has no equivalent of
 * Scrubber's category badges, only the mark/accent-red uses described in SPEC.md.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // No `darkMode` setting: Blackout is dark-only and never uses a `dark:` variant, so the
  // option (which Tailwind now treats as an alias for 'media' regardless) is moot either way.
  theme: {
    extend: {
      colors: {
        bg: '#0b0b0d',
        surface: '#131315',
        border: {
          DEFAULT: '#212124',
          soft: '#2c2c30',
        },
        text: {
          DEFAULT: '#ededed',
          muted: '#9a9aa0',
          dim: '#8a8a90',
          // Brightened from the noradz spec's `#6a6a70` / `#4a4a50` (2.2:1-3.7:1 against `bg`,
          // both below WCAG AA's 4.5:1) — the same deliberate divergence as Scrubber's, for the
          // same reason: these tokens carry section labels and captions that get read constantly.
          faint: '#7d7d84',
          faintest: '#626268',
        },
        accent: {
          DEFAULT: '#d1293d',
          hover: '#ee5a6b',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
