import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'https://bbing.xyz';

export default defineConfig({
  site,
  output: 'static',
});
