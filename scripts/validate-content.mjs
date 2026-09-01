import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function publicPathForAsset(assetPath) {
  return path.join(root, 'public', assetPath.replace(/^\.?\/?/, '').replaceAll('/', path.sep));
}

const profile = readJson('data/profile.json');
const worksData = readJson('data/works.json');
const postsData = readJson('data/posts.json');
const works = Object.values(worksData.works).flat();
const posts = postsData.posts;
const workIds = works.map((work) => work.id);
const postSlugs = posts.map((post) => post.slug);
const knownTags = new Set(postsData.tags.map((tag) => tag.id));

assert(works.length === 25, `项目数量应为 25，当前为 ${works.length}`);
// The explicit catalog size prevents accidental content loss during bulk metadata edits.
assert(posts.length === 60, `文章数量应为 60，当前为 ${posts.length}`);
assert(findDuplicates(workIds).length === 0, `存在重复项目 ID: ${findDuplicates(workIds).join(', ')}`);
assert(findDuplicates(postSlugs).length === 0, `存在重复文章 slug: ${findDuplicates(postSlugs).join(', ')}`);

for (const work of works) {
  assert(Boolean(work.id && work.title && work.description), `项目缺少必要字段: ${work.id || '(unknown)'}`);
  assert(fs.existsSync(publicPathForAsset(work.thumb)), `项目缩略图不存在: ${work.id} -> ${work.thumb}`);

  for (const [name, url] of Object.entries(work.links || {})) {
    assert(/^https:\/\//.test(url), `项目链接必须使用 https: ${work.id}.${name}`);
  }

  for (const slug of work.relatedPosts || []) {
    assert(postSlugs.includes(slug), `项目关联了不存在的文章: ${work.id} -> ${slug}`);
  }
}

for (const post of posts) {
  const markdownPath = path.join(root, 'posts', post.filename);
  assert(Boolean(post.slug && post.title && post.excerpt && post.date), `文章缺少必要字段: ${post.slug || '(unknown)'}`);
  assert(fs.existsSync(markdownPath), `文章正文不存在: ${post.slug} -> ${post.filename}`);
  post.tags.forEach((tag) => assert(knownTags.has(tag), `文章使用未知标签: ${post.slug} -> ${tag}`));

  if (!fs.existsSync(markdownPath)) continue;
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert(/^#\s+.+/m.test(markdown), `文章缺少 H1: ${post.filename}`);

  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
    const imageUrl = match[1];
    if (/^https?:\/\//.test(imageUrl)) continue;
    const normalized = imageUrl
      .replace(/^\.\//, '')
      .replace(/^\//, '')
      .replace(/^images\//, 'posts/images/');
    assert(fs.existsSync(path.join(root, 'public', normalized)), `文章图片不存在: ${post.filename} -> ${imageUrl}`);
  }
}

for (const id of profile.featuredWorkIds) {
  assert(workIds.includes(id), `首页精选项目不存在: ${id}`);
}

for (const slug of profile.featuredPostSlugs) {
  assert(postSlugs.includes(slug), `首页精选文章不存在: ${slug}`);
}

if (failures.length > 0) {
  console.error(`内容校验失败，共 ${failures.length} 项:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`内容校验通过: ${works.length} 个项目，${posts.length} 篇文章。`);
