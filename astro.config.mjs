import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://carscratch.uk',
  output: 'server',
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()]
  }
});
