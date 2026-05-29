// Blog UI controller
import { getAllPosts, getPostBySlug, getPostsTags, loadPostContent } from './blog-data.js';
import { parseMarkdown } from './markdown.js';
import { getCurrentRoute } from './router.js';

let currentFilter = 'all';
let searchQuery = '';
let listScrollY = 0;

function saveListScroll() {
  const blogList = document.getElementById('blogList');
  if (blogList && blogList.style.display !== 'none') {
    listScrollY = window.scrollY;
  }
}

function getFilteredPosts() {
  let posts = getAllPosts();
  if (currentFilter !== 'all') {
    posts = posts.filter((p) => p.tags.includes(currentFilter));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    posts = posts.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q)
    );
  }
  return posts;
}

function getPrevNext(slug) {
  const posts = getAllPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? posts[idx - 1] : null,
    next: idx < posts.length - 1 ? posts[idx + 1] : null,
  };
}

function renderBlogList() {
  const blogList = document.getElementById('blogList');
  if (!blogList) return;

  const posts = getFilteredPosts();
  if (!posts.length) {
    blogList.innerHTML = '<p class="blog-empty">暂无文章</p>';
    return;
  }

  const tagsMap = {};
  const tags = getPostsTags();
  tags.forEach((t) => { tagsMap[t.id] = t.label; });

  blogList.innerHTML = posts.map((post) => {
    const tagsHtml = post.tags.map((t) => `<span class="tag">${tagsMap[t] || t}</span>`).join('');
    const date = new Date(post.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
      <a class="blog-card reveal" href="#/blog/${post.slug}">
        <div class="blog-card__date">${date}</div>
        <h3 class="blog-card__title">${post.title}</h3>
        <p class="blog-card__excerpt">${post.excerpt}</p>
        <div class="blog-card__tags">${tagsHtml}</div>
      </a>
    `;
  }).join('');
}

function renderBlogFilters() {
  const container = document.querySelector('.blog-filters');
  if (!container || container.hasChildNodes()) return;

  const tags = getPostsTags();
  const allCount = getAllPosts().length;
  let html = `<button class="filter-chip active" data-blog-filter="all" type="button">全部<span class="filter-count">${allCount}</span></button>`;
  html += tags.map((t) => {
    const count = getAllPosts().filter((p) => p.tags.includes(t.id)).length;
    return `<button class="filter-chip" data-blog-filter="${t.id}" type="button">${t.label}<span class="filter-count">${count}</span></button>`;
  }).join('');
  container.innerHTML = html;

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    container.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.blogFilter;
    renderBlogList();
  });
}

function renderPrevNext(prev, next) {
  const el = document.getElementById('blogPrevNext');
  if (!el) return;

  let html = '';
  if (prev) {
    html += `<a class="blog-prevnext__link" href="#/blog/${prev.slug}"><span class="blog-prevnext__label">&larr; 上一篇</span><span class="blog-prevnext__title">${prev.title}</span></a>`;
  } else {
    html += '<span></span>';
  }
  if (next) {
    html += `<a class="blog-prevnext__link blog-prevnext__link--next" href="#/blog/${next.slug}"><span class="blog-prevnext__label">下一篇 &rarr;</span><span class="blog-prevnext__title">${next.title}</span></a>`;
  } else {
    html += '<span></span>';
  }
  el.innerHTML = html;
}

async function renderBlogPost(slug) {
  const post = getPostBySlug(slug);
  const blogContent = document.getElementById('blogContent');
  const blogToc = document.getElementById('blogToc');
  const blogPost = document.getElementById('blogPost');
  const blogList = document.getElementById('blogList');
  const blogControls = document.querySelector('.blog-controls');
  if (!post || !blogContent || !blogPost || !blogList) return;

  saveListScroll();
  blogList.style.display = 'none';
  blogPost.style.display = '';
  if (blogControls) blogControls.style.display = 'none';

  const md = await loadPostContent(slug);
  if (!md) {
    blogContent.innerHTML = '<p class="blog-empty">文章加载失败</p>';
    blogToc.innerHTML = '';
    return;
  }

  const { html, headings } = parseMarkdown(md);
  blogContent.innerHTML = html;
  if (typeof hljs !== 'undefined') hljs.highlightAll();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
    });
  });

  // render TOC
  if (headings.length > 1) {
    const filtered = headings.filter((h) => h.level >= 2 && h.level <= 3);
    blogToc.innerHTML = filtered.length
      ? '<h4 class="blog-post__toc-title">目录</h4>' +
        filtered.map((h) =>
          `<a class="blog-post__toc-item blog-post__toc-item--h${h.level}" href="#${h.id}">${h.text}</a>`
        ).join('')
      : '';
  } else {
    blogToc.innerHTML = '';
  }

  // prev/next navigation
  const { prev, next } = getPrevNext(slug);
  renderPrevNext(prev, next);

  // dispatch event for comments
  document.dispatchEvent(new CustomEvent('postContentLoaded', { detail: { post, slug } }));
}

function showBlogList() {
  const blogPost = document.getElementById('blogPost');
  const blogList = document.getElementById('blogList');
  const blogControls = document.querySelector('.blog-controls');
  if (blogPost) blogPost.style.display = 'none';
  if (blogList) blogList.style.display = '';
  if (blogControls) blogControls.style.display = '';
  if (listScrollY > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: listScrollY, behavior: 'instant' });
      });
    });
  }
}

function initBlog() {
  document.addEventListener('routeChanged', (e) => {
    const { route, params } = e.detail;
    const worksSection = document.getElementById('works');
    const blogSection = document.getElementById('blog');
    const navTabs = document.querySelectorAll('.nav-tab');

    if (route === 'works') {
      listScrollY = 0;
      if (worksSection) worksSection.style.display = '';
      if (blogSection) blogSection.style.display = 'none';
      navTabs.forEach((t) => t.classList.toggle('active', t.dataset.route === 'works'));
    } else {
      if (worksSection) worksSection.style.display = 'none';
      if (blogSection) blogSection.style.display = '';
      navTabs.forEach((t) => t.classList.toggle('active', t.dataset.route === 'blog'));

      if (route === 'blog-list') {
        showBlogList();
        renderBlogList();
      } else if (route === 'blog-post') {
        renderBlogPost(params.slug);
      }
    }
  });

  document.addEventListener('postsLoaded', () => {
    renderBlogFilters();
    // 数据加载完成后，检查当前路由是否需要渲染
    const route = getCurrentRoute();
    if (route.route === 'blog-post' || route.route === 'blog-list') {
      const worksSection = document.getElementById('works');
      const blogSection = document.getElementById('blog');
      const navTabs = document.querySelectorAll('.nav-tab');
      if (worksSection) worksSection.style.display = 'none';
      if (blogSection) blogSection.style.display = '';
      navTabs.forEach((t) => t.classList.toggle('active', t.dataset.route === 'blog'));

      if (route.route === 'blog-post') {
        renderBlogPost(route.params.slug);
      } else {
        showBlogList();
        renderBlogList();
      }
    }
  });

  document.addEventListener('blogSearchChanged', (e) => {
    searchQuery = e.detail.query;
    renderBlogList();
  });
}

export { initBlog };
