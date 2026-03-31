// 从 index.html 拆分的 JS
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const media = window.matchMedia('(prefers-color-scheme: dark)');
const storedTheme = localStorage.getItem('bing-works-theme') || 'auto';

function resolveTheme(theme) {
  if (theme === 'auto') {
    return media.matches ? 'dark' : 'light';
  }
  return theme;
}

function syncThemeUi(theme) {
  const resolved = resolveTheme(theme);
  root.setAttribute('data-theme', resolved);

  if (theme === 'auto') {
    themeIcon.textContent = '◐';
    themeLabel.textContent = '跟随系统';
  } else if (theme === 'dark') {
    themeIcon.textContent = '☾';
    themeLabel.textContent = '深色';
  } else {
    themeIcon.textContent = '☼';
    themeLabel.textContent = '浅色';
  }

  if (themeMeta) {
    themeMeta.setAttribute('content', resolved === 'dark' ? '#0e1117' : '#f3f4f6');
  }
}

let themeMode = storedTheme;
syncThemeUi(themeMode);

themeToggle.addEventListener('click', () => {
  themeMode = themeMode === 'auto' ? 'dark' : themeMode === 'dark' ? 'light' : 'auto';
  localStorage.setItem('bing-works-theme', themeMode);
  syncThemeUi(themeMode);
});

media.addEventListener('change', () => {
  if (themeMode === 'auto') {
    syncThemeUi('auto');
  }
});

const chips = document.querySelectorAll('.filter-chip');
const cards = document.querySelectorAll('.card');

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;

    chips.forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');

    cards.forEach((card) => {
      const tags = card.dataset.tags.split(' ');
      const matched = filter === 'all' || tags.includes(filter);
      card.style.display = matched ? '' : 'none';
    });
  });
});
