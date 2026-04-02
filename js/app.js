import { loadWorksData } from './data.js';
import { initFilters } from './filters.js';
import { initViewToggle } from './view.js';
import { initTheme } from './theme.js';
import './carousel.js';
import { initTooltipPositions } from './tooltip.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFilters();
  initViewToggle();
  loadWorksData();
  initTooltipPositions();
});
