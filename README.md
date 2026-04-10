# jsch_web

Personal portfolio site. Ghost (local CMS) → Astro (static build) → GitHub Pages.

## How it works

Ghost runs locally as a headless CMS. Astro fetches posts from Ghost's Content API at build time, downloads all images and media, and outputs a fully static site. The built files are pushed to a `gh-pages` branch which GitHub Pages serves.

## Prerequisites

- Node 22 (via nvm: `nvm use 22`)
- Ghost running locally (`cd ../jsch_web_ghost && ghost start`)
- `.env` file in this directory with:
  ```
  GHOST_URL=http://localhost:2368
  GHOST_API_KEY=<your content api key>
  ```

## Development

```
npm run dev
```

Opens at `http://localhost:4321/`. Ghost must be running for post pages to load. Content changes in Ghost require restarting the dev server.

## Testing with a full build

The dev server (`npm run dev`) is fine for most work, but some things require a full build:

- **Images on mobile**: the dev server proxies Ghost images from `localhost`, which your phone can't reach.
- **Changes to `public/`**: static assets (JS, fonts, images) are only copied into `dist/` at build time. The preview server serves from `dist/`, so changes to `public/` require a rebuild.

```
npx astro build && npx astro preview --host 0.0.0.0
```

Opens at `http://localhost:4321/`. To test on your phone, open `http://<your-mac-ip>:4321/` (both devices on the same Wi-Fi). Find your Mac's IP with `ipconfig getifaddr en0`.

If a build ever genuinely seems stuck, force a clean rebuild with `rm -rf node_modules/.astro dist`.

## Deploy

```
./deploy.sh
```

Builds the site, then pushes the output to the `gh-pages` branch. Ghost must be running.

## Project structure

```
src/
  pages/          — index.astro (homepage), [slug].astro (Ghost posts)
  components/     — homepage sections (Hero, About, Contact, etc.)
  styles/         — homepage CSS (styles/) and Ghost content CSS
  assets/         — SVGs inlined at build time
public/
  fonts/          — custom fonts
  js/             — client-side scripts (shaders, lightbox, modals, etc.)
  img/            — homepage images
  content/        — Ghost assets, downloaded at build time (gitignored)
```
