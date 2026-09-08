export class ThemeManager {
  public static init(): void {
    const updateTheme = () => {
      const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          updateTheme();
        }
      }
    });

    observer.observe(document.body, { attributes: true });
    updateTheme();
  }
}

