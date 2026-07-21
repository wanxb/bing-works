import rss from '@astrojs/rss';
import { siteProfile } from '../config/site';
import { getAllPosts } from '../lib/content';

export async function GET(context: { site?: URL }) {
  return rss({
    title: 'Bing Writing',
    description: siteProfile.description,
    site: context.site || 'https://bbing.xyz',
    customData: '<language>zh-CN</language>',
    items: getAllPosts().map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: new Date(`${post.date}T00:00:00+08:00`),
      link: `/blog/${post.slug}/`,
      categories: [post.topic, ...post.tags],
      author: post.author,
    })),
  });
}

