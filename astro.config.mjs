// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const { GHOST_URL, GHOST_API_KEY } = loadEnv(process.env.NODE_ENV ?? '', process.cwd(), '');
const API_KEY = GHOST_API_KEY;

// Custom integration that downloads Ghost images and media before the build
function ghostAssets() {
  return {
    name: 'ghost-assets',
    hooks: {
      'astro:build:start': async () => {
        console.log('Fetching Ghost posts and downloading assets...');

        const res = await fetch(
          `${GHOST_URL}/ghost/api/content/posts/?key=${API_KEY}&include=tags`
        );
        const { posts } = await res.json();

        for (const post of posts) {
          const escapedUrl = GHOST_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const imageUrls = [...post.html.matchAll(new RegExp(escapedUrl + '(\\/content\\/(?:images|media)\\/[^"\'\\s]+)', 'g'))];

          for (const match of imageUrls) {
            const localPath = match[1];
            const destPath = path.join(process.cwd(), 'public', localPath);

            if (fs.existsSync(destPath)) continue;

            fs.mkdirSync(path.dirname(destPath), { recursive: true });

            const imgRes = await fetch(`${GHOST_URL}${localPath}`);
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            fs.writeFileSync(destPath, buffer);
            console.log(`Downloaded: ${localPath}`);
          }
        }
      },
    },
  };
}

export default defineConfig({
  integrations: [ghostAssets()],
});
