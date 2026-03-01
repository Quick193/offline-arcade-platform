export interface ThemeTokens {
  '--bg': string;
  '--fg': string;
  '--accent': string;
  '--panel': string;
  '--text': string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  tokens: ThemeTokens;
  crtScanline?: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    tokens: {
      '--bg': '#0d1118',
      '--fg': '#1a2432',
      '--accent': '#2ad7ff',
      '--panel': '#141d2a',
      '--text': '#ebf2ff',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    tokens: {
      '--bg': '#05080e',
      '--fg': '#121a2b',
      '--accent': '#27ff9f',
      '--panel': '#0b1120',
      '--text': '#dfffea',
    },
  },
  {
    id: 'retro-crt',
    name: 'Retro CRT',
    crtScanline: true,
    tokens: {
      '--bg': '#081508',
      '--fg': '#102412',
      '--accent': '#7cff7a',
      '--panel': '#0d1c0f',
      '--text': '#d4ffd4',
    },
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    tokens: {
      '--bg': '#f4f6fa',
      '--fg': '#ffffff',
      '--accent': '#1d5bff',
      '--panel': '#e9eef7',
      '--text': '#1f2530',
    },
  },
  {
    id: 'glass-ui',
    name: 'Glass UI',
    tokens: {
      '--bg': '#c5d7e5',
      '--fg': 'rgba(255,255,255,0.28)',
      '--accent': '#0d8dff',
      '--panel': 'rgba(255,255,255,0.45)',
      '--text': '#0f1f2f',
    },
  },
];

export class ThemeManager {
  private currentTheme = THEMES[0];

  setTheme(themeId: string): void {
    const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];
    this.currentTheme = theme;
    Object.entries(theme.tokens).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    document.body.classList.toggle('theme-crt', Boolean(theme.crtScanline));
    document.documentElement.dataset.theme = theme.id;
  }

  getTheme(): ThemeDefinition {
    return this.currentTheme;
  }

  listThemes(): ThemeDefinition[] {
    return THEMES;
  }
}
