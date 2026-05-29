import { loadWorksData } from './data.js';
import { initFilters } from './filters.js';
import { initViewToggle } from './view.js';
import { initTheme } from './theme.js';
import './carousel.js';
import { initTooltipPositions } from './tooltip.js';
import { initRouter } from './router.js';
import { loadPostsData } from './blog-data.js';
import { initBlog } from './blog.js';
import { initBlogSearch } from './blog-search.js';
import { initComments } from './comments.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFilters();
  initViewToggle();
  loadWorksData();
  initTooltipPositions();
  initRouter();
  loadPostsData();
  initBlog();
  initBlogSearch();
  initComments();
});
