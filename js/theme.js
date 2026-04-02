const media = window.matchMedia('(prefers-color-scheme: dark)');
const themeIcons = {
  dark: `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"></path>
    </svg>
  `,
  light: `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7.2 7.2 0 1 0 9.8 9.8z"></path>
    </svg>
  `
};

function getInitialTheme() {
  const storedTheme = localStorage.getItem('bing-works-theme');
  return storedTheme || (media.matches ? 'dark' : 'light');
}

function syncThemeUi(theme, themeIcon, themeMeta) {
  document.documentElement.setAttribute('data-theme', theme);

  if (themeIcon) {
    themeIcon.innerHTML = theme === 'dark' ? themeIcons.dark : themeIcons.light;
  }

  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#0e1117' : '#f3f4f6');
  }
}

function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeToggle || !themeIcon || window._bingWorksThemeBound) return;

  let themeMode = getInitialTheme();
  syncThemeUi(themeMode, themeIcon, themeMeta);

  themeToggle.addEventListener('click', () => {
    themeMode = themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('bing-works-theme', themeMode);
    syncThemeUi(themeMode, themeIcon, themeMeta);
  });

  media.addEventListener('change', (e) => {
    if (!localStorage.getItem('bing-works-theme')) {
      themeMode = e.matches ? 'dark' : 'light';
      syncThemeUi(themeMode, themeIcon, themeMeta);
    }
  });

  window._bingWorksThemeBound = true;
}

export { initTheme };
