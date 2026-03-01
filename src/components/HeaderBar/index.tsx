import { Button } from '@/ui/Button';

interface HeaderBarProps {
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  aiEnabled: boolean;
  onToggleAI: () => void;
}

export function HeaderBar({ onOpenSettings, onOpenProfile, aiEnabled, onToggleAI }: HeaderBarProps): JSX.Element {
  return (
    <header className="header-bar">
      <div className="title">Arcade Nexus</div>
      <div className="header-actions">
        <Button variant="secondary" className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <span className="desktop">Settings</span>
          <span className="mobile">S</span>
        </Button>
        <Button variant="secondary" className="icon-btn" onClick={onOpenProfile} aria-label="Profile">
          <span className="desktop">Profile</span>
          <span className="mobile">P</span>
        </Button>
        <Button
          variant={aiEnabled ? 'primary' : 'ghost'}
          className="icon-btn"
          onClick={onToggleAI}
          aria-label="AI Toggle"
        >
          <span className="desktop">AI {aiEnabled ? 'On' : 'Off'}</span>
          <span className="mobile">AI</span>
        </Button>
      </div>
    </header>
  );
}
