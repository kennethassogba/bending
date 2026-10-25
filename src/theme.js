(() => {
  let theme = 'dark';
  try { if (localStorage.getItem('get-bent-theme') === 'light') theme = 'light'; } catch { /* Dark remains the default when storage is unavailable. */ }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0e0f13' : '#ffffff';
})();
