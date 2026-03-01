import { Slider } from '@/ui/Slider';
import { Toggle } from '@/ui/Toggle';
import { ThemeSelector } from '@/components/ThemeSelector';
import { GAME_LIST } from '@/data/gameList';
import type { SettingsState } from '@/engine/SettingsManager';

interface SettingsMenuProps {
  settings: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onGameAIChange: (gameId: string, value: boolean) => void;
}

export function SettingsMenu({ settings, onUpdate, onGameAIChange }: SettingsMenuProps): JSX.Element {
  return (
    <div className="settings-menu">
      <div className="setting-row">
        <div className="label">Volume</div>
        <Slider value={settings.globalVolume} onChange={(globalVolume) => onUpdate({ globalVolume })} />
      </div>
      <div className="setting-row">
        <div className="label">Music volume</div>
        <Slider value={settings.musicVolume} onChange={(musicVolume) => onUpdate({ musicVolume })} />
      </div>
      <div className="setting-row">
        <div className="label">SFX volume</div>
        <Slider value={settings.sfxVolume} onChange={(sfxVolume) => onUpdate({ sfxVolume })} />
      </div>
      <div className="setting-row">
        <div className="label">Theme</div>
        <ThemeSelector current={settings.theme} onSelect={(theme) => onUpdate({ theme })} />
      </div>
      <div className="setting-row">
        <div className="label">Global AI toggle</div>
        <Toggle checked={settings.globalAIEnabled} onChange={(globalAIEnabled) => onUpdate({ globalAIEnabled })} />
      </div>
      <div className="setting-row">
        <div className="label">Debug overlay</div>
        <Toggle checked={settings.debugOverlay} onChange={(debugOverlay) => onUpdate({ debugOverlay })} />
      </div>
      <div className="setting-row setting-row-column">
        <div className="label">Per-game AI toggles</div>
        <div className="per-game-ai-list">
          {GAME_LIST.map((gameId) => (
            <Toggle
              key={gameId}
              label={gameId}
              checked={settings.perGameAI[gameId] ?? settings.globalAIEnabled}
              onChange={(value) => onGameAIChange(gameId, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
