# Blackout

Redact screenshots and PDFs so the removed content is actually gone.

Draw rectangles over the parts of an image or a PDF that shouldn't be shared, and Blackout
gives you back a file where those pixels have been destroyed and the file rebuilt around
them — not a black shape sitting on top of content that anyone can still copy, paste or
recover.

**Live at [blackout.noradz.io](https://blackout.noradz.io).**

The companion to [Scrubber](https://scrubber.noradz.io), which does the same job for text
you paste.

> **Status: in development.** The build order is being worked through stage by stage; not
> everything described below is implemented yet.

## The guarantee

**Nothing leaves the page.** Blackout is a static site with no backend. It makes no network
requests of any kind — no CDN, no web fonts, no analytics, no error reporting. That isn't a
promise in a privacy policy; it's enforced by a Content-Security-Policy tag in `index.html`
with `connect-src 'none'`, which you can read for yourself. Your file is opened by your
browser, edited in your browser, and saved by your browser. Nothing is stored, either — no
`localStorage`, no IndexedDB, no cookies, no cache of anything you loaded.

**Redaction removes, it doesn't cover.** Every export is re-encoded from a pixel buffer that
has already had the marked regions overwritten in black. For PDFs, the exported file is a
brand-new document — no text object, embedded font glyph, image, annotation, attachment or
metadata field from the original is carried across.

Because re-encoding is how the export works, metadata removal comes with it: EXIF (including
GPS), XMP, IPTC, colour profiles and embedded thumbnails don't survive. The embedded
thumbnail is the one people miss — a "redacted" screenshot whose EXIF thumbnail still shows
the original isn't redacted at all.

## What it handles

- **Images** — PNG, JPEG and WebP in; PNG out.
- **PDFs** — including password-protected ones. Multi-page, with per-page marks.

## What a PDF export costs

To be certain nothing survives underneath a mark, Blackout renders each page to a bitmap and
rebuilds the PDF from those images. That means:

- **Selectable text is lost.** The output is a picture of the document, not a text document.
- **The file gets larger**, sometimes considerably.
- **An encrypted source exports unencrypted.** If the original needed a password, the
  redacted copy won't have one — re-protect it yourself if it matters.

These trade-offs are the price of the guarantee, and the app states them before you export
rather than after.

## What it deliberately doesn't do

There's no blur and no pixelate option. Both are reversible in principle, and pixelated text
has been recovered in practice. Solid fill is the only mode, because a tool whose whole point
is "this is actually gone" shouldn't also have a mode where it isn't.

It also doesn't scan your file for you. Nothing is detected, suggested or automatically
marked — what you mark is what's removed, and the app never implies it checked the rest.

There is no undo after export. Your original file on disk is never modified.

## Running it locally

```sh
npm install
npm run dev
```

Then open the URL Vite prints.

Other scripts:

```sh
npm test            # unit tests
npm run lint        # oxlint
npm run build       # production build into dist/
npm run build:single  # single self-contained blackout.html
```

## The offline version

`npm run build:single` produces `blackout.html` — the whole app, dependencies included, in
one file. Save it anywhere, open it in a browser with no network connection at all, and it
works exactly the same. It's also downloadable directly from the live site at
[blackout.noradz.io/blackout.html](https://blackout.noradz.io/blackout.html).

## Licence

MIT. See [LICENSE](LICENSE).
