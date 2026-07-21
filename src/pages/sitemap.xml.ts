import { SITE_URL } from '../config/site';
import { getAllPosts, getAllWorks } from '../lib/content';

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET() {
  const pages = [
    { path: '/', lastmod: undefined },
    { path: '/about/', lastmod: undefined },
    { path: '/works/', lastmod: undefined },
    { path: '/blog/', lastmod: undefined },
    ...getAllWorks().map((work) => ({ path: `/works/${work.id}/`, lastmod: undefined })),
    ...getAllPosts().map((post) => ({ path: `/blog/${post.slug}/`, lastmod: post.updated || post.date })),
  ];

  const body = pages.map((page) => {
    const location = escapeXml(new URL(page.path, `${SITE_URL}/`).toString());
    const lastmod = page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : '';
    return `<url><loc>${location}</loc>${lastmod}</url>`;
  }).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
}

