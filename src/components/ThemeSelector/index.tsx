import { THEMES } from '@/engine/ThemeManager';

interface ThemeSelectorProps {
  current: string;
  onSelect: (themeId: string) => void;
}

export function ThemeSelector({ current, onSelect }: ThemeSelectorProps): JSX.Element {
  return (
    <div className="theme-selector">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className={`theme-option ${theme.id === current ? 'active' : ''}`}
          onClick={() => onSelect(theme.id)}
        >
          {theme.name}
        </button>
      ))}
    </div>
  );
}
