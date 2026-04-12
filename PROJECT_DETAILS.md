# Project Details

## Stack

- **Ghost** — headless CMS on Mac Mini, accessed via Tailscale. Editor only, not hosted publicly.
- **Astro** — static site generator. Fetches posts from Ghost Content API. Outputs `dist/`.
- **GitHub Pages** — deployment target. Repo: `angelday/jsch_web`.
- Ghost install: `/Users/jozsi/Sites/jsch_web_ghost` (Astro project is at `/Users/jozsi/Sites/jsch_web`).
- Ghost Content API key stored in `.env` (gitignored)

## Deployment

- **Local build + push to `gh-pages` branch** — Ghost is on a private Tailscale network, so GitHub Actions can't build.
- `./deploy.sh` runs `npx astro build`, then force-pushes `dist/` to `gh-pages`.
- Site is served at the custom domain `jozsefschaffer.com` root, so no `--base` prefix is needed — links are root-relative in both dev (`localhost:4321`) and prod.
- `.nojekyll` in `public/` prevents GitHub Pages from ignoring `_astro/` directory.
- Source code on `main`, built output on `gh-pages` — independent workflows.

## Environment

- `.env` file (gitignored) with `GHOST_URL` and `GHOST_API_KEY`
- `astro.config.mjs` uses Vite's `loadEnv()` (runs before Vite, no `import.meta.env`)
- `.astro` frontmatter uses `import.meta.env.*` (server-side, no `PUBLIC_` prefix needed)
- `getStaticPaths()` runs in isolated scope — env vars must be accessed inside the function, not from module-level

## Project Structure

```
src/
  pages/
    index.astro          — homepage (imports components)
    projects/index.astro — projects grid + blog list (split by "Post" tag)
    [slug].astro         — Ghost post pages (blog posts, projects, case studies)
  components/
    Hero.astro           — hero section with WebGL shader
    IkeaSection.astro    — IKEA case study preview + iframe
    AboutSection.astro   — about section with CGA backdrop
    ContactSection.astro — LinkedIn + email cards with shaders
    TheatreModal.astro   — "about me" modal
  styles/
    styles.css           — homepage CSS entry (imports homepage/*)
    homepage/            — modular homepage CSS (tokens, base, fonts, hero, sections, modal, about-cursor, responsive)
    ghost-content.css    — Ghost content layout (grid, typography, images, video)
    case-study.css       — case study page layout
    post.css             — post page layout
    lightbox.css         — lightbox overlay styles
  assets/
    grafana_logo.svg     — inlined at build time via ?raw import
public/
  .nojekyll
  favicon.png
  og-image.png
  fonts/                 — Trial Arlen, IBM BIOS, Noto IKEA
  js/                    — main.js, hero-shader, hero-nav, about-cursor, theatre-modal, ghost-cards, lightbox
  img/                   — homepage images (CGA cursors, GIFs, IKEA logo, modal assets)
  content/               — gitignored, Ghost downloads (images + media)
```

## Homepage

- Originally built in Framer, manually rebuilt as vanilla HTML/CSS/JS
- WebGL shader system (hero + contact cards) with presets and hover transitions
- CGA retro aesthetic (magenta, pixel fonts, custom cursor)
- Theatre modal system (data-attribute driven, focus trap, ESC to close)
- Fonts: Trial Arlen Black/Light, Ac437 IBM BIOS, PP Neue Machina Inktrap, Noto IKEA Latin
- All JS is framework-agnostic ES modules, loaded via `<script is:inline type="module">`

## Content Types & Ghost Tags

### Control tags (internal, `#`-prefixed)
- `#case-study` — renders the post as a case study (no header, wider padding, fact-sheet card support). Applied via `body.case-study` class.
- `#hidden` — excludes the post from the `/projects/` index entirely.

### Content type tags (user-facing)
- **Post** — blog entry. Displayed in the "Blog" section of `/projects/` as a horizontal card. Sorted by **published date**. The published date is canonical — no "updated" label.
- **App** — a project/tool. Displayed as a vertical card in the "Projects" grid. Sorted by **updated date**. Card shows "Updated [date]". Post page shows "Originally published [date] · Updated [date]" when dates differ.
- **Knowledge Base** — reference/guide content. Same display rules as App (project card + updated date convention).

### Date convention
- **Blog posts** (tagged "Post"): published date only, everywhere (card + post page).
- **Projects** (everything else): living documents, updated over time.
  - Card: "Updated [date]"
  - Post page byline: "Originally published [date] · Updated [date]" (collapses to just the published date if never updated)

## Post & Case Study Pages (Ghost content)

### Design language
- Fonts: Bricolage Grotesque (headings) + Literata (body) via Google Fonts
- Colors: blush peach bg (#FCF4EE), plum headings (#5C2A3E), dark body (#2A1F23)
- Vertical rhythm adapted from Ghost's Casper theme

### Build-time HTML transforms (`[slug].astro`)
- **Alt-text signals** (image cards, stripped from output):
  - `no-zoom` → disables lightbox (`data-no-lightbox`)
  - `wide-width` → adds `kg-width-wide` to parent figure. Use for animated GIFs where Ghost's editor hides the width toggle.
- **Embed caption signals** (YouTube etc., stripped from output):
  - `wide-width` in the embed card's caption field → adds `kg-width-wide`. Drops the figcaption if the signal was the only content. Ghost doesn't expose alt for embeds, so caption is the only writable field.
- **Embed card styling:** YouTube's hardcoded 200×150 iframe is overridden to 100% width + 16:9 aspect-ratio. On mobile it goes full-bleed like image cards.
- **Video cards:** Ghost's player markup → native `<video>` tag (preserves loop/autoplay/poster/caption)
- **Outgoing links:** `http(s)://...` hrefs rewritten to `target="_blank" rel="noopener noreferrer"`
- **Ghost ref tracking:** `?ref=<host>` stripped from all link URLs via `/\?ref=[^"&\s]*/g` — host-agnostic so it works regardless of which machine builds (localhost, Tailscale, etc.)
- **Blockquote conventions:** "Fact sheet" first line → `class="fact-sheet"` card (50% width, centered, plum tint)
- **"My contribution" list:** `<br>`-separated lines → `<ul>` inside fact sheet
- **Inline icons:** `{name}` tokens in Ghost prose → inline SVG (e.g. Grafana logo). Ghost strips one layer of braces.
- **URL rewriting:** `GHOST_URL` → `BASE_URL` in production builds only

### Lightbox
- Always shows image at 100% (natural size) with pan support
- Blurred backdrop with faint plum tint
- Keyboard (ESC, arrows), swipe on mobile, drag to pan
- Safari fix: `draggable="false"`, `dragstart` preventDefault, `-webkit-user-drag: none`

### Back navigation
- Fixed pill top-left: "← jozsefschaffer.com"
- Blurred bg with plum tint, 2px dark stroke, plum fill on hover
- Uses `<style is:global>` to avoid scoped-style race condition

### Asset paths
- All paths use `const base = import.meta.env.BASE_URL.replace(/\/$/, '')` — resolves to `''` in both dev and prod (no `--base` used), so assets work without double slashes

## Ghost Content API

- Returns raw HTML with `kg-` prefixed classes
- Image cards: responsive `srcset` (600w, 1000w, 1600w, original). No WebP/AVIF.
- Video cards: full custom player markup, thumbnail at `*_thumb.jpg`
- Gallery cards: need aspect-ratio JS (`ghost-cards.js`)
- Content API does NOT expose lexical format — only html/plaintext

## Gotchas

### Astro/Vite duplicate media queries
Avoid duplicate `@media` blocks at the same breakpoint in the same CSS file. Second one gets silently dropped in dev. Consolidate into a single block.

### Astro scoped styles race with global CSS
`<style>` in `.astro` files is scoped via `data-astro-cid-*`. When competing with imported global CSS, scoped styles can flash then disappear during dev HMR. Fix: use `<style is:global>`.

### Ghost strips curly braces
`{{token}}` in Ghost editor → `{token}` in HTML output. Regex must match single braces.

### GitHub Pages + Jekyll
Jekyll ignores `_` prefixed directories. Astro outputs CSS to `_astro/`. Must include `.nojekyll` in the deploy.

### Astro getStaticPaths caching
`getStaticPaths()` runs once at dev server startup. Ghost content changes require restarting `astro dev`.

### Node version
Ghost requires Node 20, 22, or 24. Using nvm (`nvm use 22`). Ghost install path must not contain spaces.

### Dev vs production asset URLs
In dev, Ghost URLs are left as-is (Ghost serves directly). In production, the origin is derived from `post.url` (whatever host Ghost is configured with — localhost, Tailscale, etc.) and rewritten to `base`. Deriving from `post.url` instead of `GHOST_URL` keeps builds correct even when Ghost's configured `url` doesn't match the `.env` value.
