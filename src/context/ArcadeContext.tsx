import React, { createContext, useContext, useEffect, useState } from 'react';
import { EventEmitter } from '@/utils/eventEmitter';
import { ParticleEngine } from '@/engine/ParticleEngine';
import { ThemeManager } from '@/engine/ThemeManager';
import { AudioManager } from '@/engine/AudioManager';
import { SettingsManager, type SettingsState } from '@/engine/SettingsManager';
import { AchievementManager } from '@/engine/AchievementManager';
import { ProfileManager } from '@/engine/ProfileManager';
import { InputManager } from '@/engine/InputManager';
import { AIManager } from '@/engine/AIManager';
import type { EngineContext, EngineEvents } from '@/engine/Scene';

export interface ArcadeContextValue {
  engine: EngineContext;
  settings: SettingsState;
  setSettings: (partial: Partial<SettingsState>) => void;
  setPerGameAI: (gameId: string, enabled: boolean) => void;
}

const ArcadeContext = createContext<ArcadeContextValue | null>(null);

export function ArcadeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [settingsManager] = useState(() => new SettingsManager());
  const [theme] = useState(() => new ThemeManager());
  const [audio] = useState(() => new AudioManager());
  const [particles] = useState(() => new ParticleEngine());
  const [input] = useState(() => new InputManager(window));
  const [achievements] = useState(() => new AchievementManager());
  const [profile] = useState(() => new ProfileManager());
  const [eventBus] = useState(() => new EventEmitter<EngineEvents>());
  const [ai] = useState(() => new AIManager(input, settingsManager));

  const [settings, setSettingsState] = useState<SettingsState>(settingsManager.getState());

  useEffect(() => {
    theme.setTheme(settings.theme);
    audio.setVolumes(settings.globalVolume, settings.musicVolume, settings.sfxVolume);
    ai.setGlobalEnabled(settings.globalAIEnabled);
  }, [audio, ai, settings.globalAIEnabled, settings.globalVolume, settings.musicVolume, settings.sfxVolume, settings.theme, theme]);

  useEffect(
    () =>
      settingsManager.events.on('changed', (next) => {
        setSettingsState(next);
      }),
    [settingsManager.events],
  );

  const value: ArcadeContextValue = {
    engine: {
      input,
      particles,
      theme,
      audio,
      settings: settingsManager,
      achievements,
      profile,
      ai,
      eventBus,
    },
    settings,
    setSettings: (partial) => {
      settingsManager.update(partial);
    },
    setPerGameAI: (gameId, enabled) => {
      settingsManager.setPerGameAI(gameId, enabled);
      ai.setGameEnabled(gameId, enabled);
    },
  };

  return <ArcadeContext.Provider value={value}>{children}</ArcadeContext.Provider>;
}

export function useArcadeContext(): ArcadeContextValue {
  const value = useContext(ArcadeContext);
  if (!value) {
    throw new Error('Arcade context unavailable');
  }
  return value;
}
