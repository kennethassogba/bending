(() => {
  let theme = 'light';
  try { if (localStorage.getItem('get-bent-theme') === 'dark') theme = 'dark'; } catch { /* Light remains the default when storage is unavailable. */ }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0e0f13' : '#ffffff';
})();
