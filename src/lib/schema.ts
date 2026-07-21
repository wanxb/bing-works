import { SITE_URL, siteProfile } from '../config/site';
import type { PostMeta, Work } from './content';

export function absoluteUrl(pathname: string) {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteProfile.name,
    url: absoluteUrl('/'),
    sameAs: [siteProfile.links.github],
    knowsAbout: [
      'AI Agent',
      'Large Language Models',
      'AI System Architecture',
      'Agent Engineering',
      'Engineering Leadership',
    ],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteProfile.siteName,
    url: absoluteUrl('/'),
    description: siteProfile.description,
    inLanguage: 'zh-CN',
    author: { '@type': 'Person', name: siteProfile.name },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function workSchema(work: Work) {
  const type = work.schemaType || 'CreativeWork';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: work.title,
    alternateName: work.subtitle,
    description: work.description,
    url: absoluteUrl(`/works/${work.id}/`),
    image: absoluteUrl(work.thumb),
    creator: { '@type': 'Person', name: work.author },
    inLanguage: 'zh-CN',
  };

  if (work.links.demo) schema.sameAs = work.links.demo;
  if (work.links.source) schema.codeRepository = work.links.source;
  if (type === 'SoftwareApplication') schema.applicationCategory = work.category;
  if (type === 'LearningResource') schema.learningResourceType = '自学教程';

  return schema;
}

export function articleSchema(post: PostMeta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { '@type': 'Person', name: post.author, url: absoluteUrl('/about/') },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}/`),
    url: absoluteUrl(`/blog/${post.slug}/`),
    articleSection: post.topic,
    keywords: post.tags.join(', '),
    inLanguage: 'zh-CN',
  };
}

export function collectionSchema(name: string, description: string, path: string, items: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absoluteUrl(path),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((url, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(url),
      })),
    },
  };
}

