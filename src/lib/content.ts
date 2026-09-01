import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown, type Heading } from './markdown';
import type { Topic } from '../config/site';

export interface WorkLinkSet {
  demo?: string;
  source?: string;
}

export interface WorkCaseStudy {
  background?: string;
  role?: string;
  constraints?: string[];
  decisions?: string[];
  implementation?: string[];
  delivery?: string;
  reflection?: string;
}

export interface Work {
  id: string;
  tags: string[];
  thumb: string;
  author: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  sort: number;
  delay?: number;
  links: WorkLinkSet;
  year?: number;
  focus?: string[];
  relatedPosts?: string[];
  schemaType?: 'SoftwareApplication' | 'LearningResource' | 'CreativeWork';
  caseStudy?: WorkCaseStudy;
}

interface WorksData {
  filters: Array<{ id: string; label: string; info?: string; hasInfo?: boolean }>;
  works: Record<string, Work[]>;
}

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  updated?: string;
  tags: string[];
  excerpt: string;
  filename: string;
  author: string;
  topic: Topic;
  readingMinutes: number;
  relatedWorks: Work[];
}

export interface Post extends PostMeta {
  markdown: string;
  html: string;
  headings: Heading[];
}

interface PostsData {
  tags: Array<{ id: string; label: string }>;
  posts: Array<Omit<PostMeta, 'topic' | 'readingMinutes' | 'relatedWorks'>>;
}

const root = process.cwd();
const worksData = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'works.json'), 'utf8'),
) as WorksData;
const postsData = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'posts.json'), 'utf8'),
) as PostsData;

const topicSlugSets: Record<Topic, Set<string>> = {
  'Agent 架构': new Set([
    'agent-boundary',
    'ai-agent-system-design',
    'multi-agent-patterns',
    'mcp-protocol-guide',
    'function-calling-mechanism',
    'fullstack-ai-assistant',
    'moto-agent-practice',
    'issuepilot-practice',
    'llm-robotics-mcp',
  ]),
  '生产工程': new Set([
    'agent-observability-governance',
    'llm-observability-evaluation',
    'local-model-deployment',
    'llm-inference-optimization',
    'software-upgrade-agent-practice',
    'rag-advanced',
    'rag-knowledge-base',
    'docker-to-k8s',
    'high-concurrency-patterns',
  ]),
  'AI 原理': new Set([
    'llm-training-full-picture',
    'transformer-deep-dive',
    'ml-basics',
    'prompt-engineering-systematic',
  ]),
  '技术领导力': new Set([
    'knowledge-intensive-agent-traps',
    'enterprise-agent-path',
    'agent-microservice-integration',
    'legacy-system-ai-upgrade',
    'tob-saas-agent-refactor',
    'agent-industry-landscape',
  ]),
  '工程实践': new Set([
    'codex-samsung-tv-region',
  ]),
  '随笔': new Set(),
};

function topicForPost(slug: string, tags: string[]): Topic {
  for (const [topic, slugs] of Object.entries(topicSlugSets) as Array<[Topic, Set<string>]>) {
    if (slugs.has(slug)) return topic;
  }
  if (tags.includes('ai')) return 'AI 原理';
  if (tags.includes('thoughts') || tags.includes('life')) return '随笔';
  return '工程实践';
}

function normalizeThumb(thumb: string) {
  return `/${thumb.replace(/^\.\//, '')}`;
}

export function getAllWorks(): Work[] {
  return Object.values(worksData.works)
    .flat()
    .map((work) => ({ ...work, thumb: normalizeThumb(work.thumb) }))
    .sort((a, b) => {
      if (a.author === b.author) return a.sort - b.sort;
      return a.author === 'Bing' ? -1 : 1;
    });
}

export function getWorkById(id: string) {
  return getAllWorks().find((work) => work.id === id);
}

export function getWorkFilters() {
  return worksData.filters.filter((filter) => !['bing', 'arodes'].includes(filter.id));
}

function relatedWorksForPost(slug: string) {
  return getAllWorks().filter((work) => work.relatedPosts?.includes(slug));
}

function readPostMarkdown(filename: string) {
  return fs.readFileSync(path.join(root, 'posts', filename), 'utf8');
}

function estimateReadingMinutes(markdown: string) {
  const compactLength = markdown.replace(/```[\s\S]*?```/g, '').replace(/\s/g, '').length;
  return Math.max(1, Math.ceil(compactLength / 500));
}

export function getAllPosts(): PostMeta[] {
  return postsData.posts
    .map((post) => {
      const markdown = readPostMarkdown(post.filename);
      return {
        ...post,
        topic: topicForPost(post.slug, post.tags),
        readingMinutes: estimateReadingMinutes(markdown),
        relatedWorks: relatedWorksForPost(post.slug),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): Post | undefined {
  const post = getAllPosts().find((item) => item.slug === slug);
  if (!post) return undefined;

  const markdown = readPostMarkdown(post.filename);
  const { html, headings } = renderMarkdown(markdown);
  return { ...post, markdown, html, headings };
}

export function getRelatedPosts(slug: string, limit = 3) {
  const current = getAllPosts().find((post) => post.slug === slug);
  if (!current) return [];

  return getAllPosts()
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      score:
        (post.topic === current.topic ? 3 : 0) +
        post.tags.filter((tag) => current.tags.includes(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
    .slice(0, limit)
    .map(({ post }) => post);
}

export function getAdjacentPosts(slug: string) {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}

export function getTagLabel(id: string) {
  return postsData.tags.find((tag) => tag.id === id)?.label || id;
}
