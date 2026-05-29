// Blog data layer
let postsData = null;
let postContentCache = {};

async function loadPostsData() {
  try {
    const response = await fetch('./data/posts.json');
    if (!response.ok) return;
    postsData = await response.json();
    window._bingPostsData = postsData;
    document.dispatchEvent(new CustomEvent('postsLoaded', { detail: postsData }));
  } catch (e) {
    // posts.json not available yet, silently ignore
  }
}

function getAllPosts() {
  if (!postsData) return [];
  return [...postsData.posts].sort((a, b) => b.date.localeCompare(a.date));
}

function getPostBySlug(slug) {
  if (!postsData) return null;
  return postsData.posts.find((p) => p.slug === slug) || null;
}

function getPostsTags() {
  if (!postsData) return [];
  return postsData.tags || [];
}

async function loadPostContent(slug) {
  if (postContentCache[slug]) return postContentCache[slug];
  const post = getPostBySlug(slug);
  if (!post) return null;
  try {
    const response = await fetch(`./posts/${post.filename}`);
    if (!response.ok) return null;
    const md = await response.text();
    postContentCache[slug] = md;
    return md;
  } catch (e) {
    return null;
  }
}

export { loadPostsData, getAllPosts, getPostBySlug, getPostsTags, loadPostContent };
