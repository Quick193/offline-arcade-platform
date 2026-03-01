import { useEffect, useMemo, useRef, useState } from 'react';
import { ArcadeProvider, useArcadeContext } from '@/context/ArcadeContext';
import { ArcadeShell } from '@/components/ArcadeShell';
import { HeaderBar } from '@/components/HeaderBar';
import { FooterBar } from '@/components/FooterBar';
import { MainMenu } from '@/components/MainMenu';
import { SettingsMenu } from '@/components/SettingsMenu';
import { AchievementScreen } from '@/components/AchievementScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { DebugOverlay } from '@/components/DebugOverlay';
import { GAME_META } from '@/data/gameMeta';
import { GAME_REGISTRY } from '@/games';
import type { GameHandle } from '@/engine/Scene';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Tabs, type TabDefinition } from '@/ui/Tabs';

type Screen = 'menu' | 'settings' | 'profile' | 'achievements' | 'game';

function ArcadeApp(): JSX.Element {
  const { engine, settings, setSettings, setPerGameAI } = useArcadeContext();
  const [screen, setScreen] = useState<Screen>('menu');
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [menuTab, setMenuTab] = useState('games');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const [achievementTick, setAchievementTick] = useState(0);
  const [debugTick, setDebugTick] = useState(0);

  const tabs: TabDefinition[] = useMemo(
    () => [
      { id: 'games', label: 'Games' },
      { id: 'achievements', label: 'Achievements' },
    ],
    [],
  );

  const stopCurrentGame = () => {
    handleRef.current?.stop();
    handleRef.current = null;
  };

  const openGame = (gameId: string) => {
    setCurrentGameId(gameId);
    setScreen('game');
  };

  const closeGame = () => {
    stopCurrentGame();
    setCurrentGameId(null);
    setScreen('menu');
  };

  useEffect(() => {
    if (screen !== 'game' || !currentGameId || !canvasRef.current) return;

    stopCurrentGame();
    const createGame = GAME_REGISTRY[currentGameId];
    if (!createGame) return;

    const handle = createGame(canvasRef.current, engine);
    handleRef.current = handle;
    handle.start();

    const gameAIEnabled = settings.perGameAI[currentGameId] ?? settings.globalAIEnabled;
    if (gameAIEnabled) {
      handle.startAI();
    }

    return () => {
      handle.stop();
      if (handleRef.current === handle) {
        handleRef.current = null;
      }
    };
  }, [screen, currentGameId, engine]);

  useEffect(() => {
    if (!currentGameId) return;
    const enabled = settings.perGameAI[currentGameId] ?? settings.globalAIEnabled;
    if (enabled) {
      handleRef.current?.startAI();
    } else {
      handleRef.current?.stopAI();
    }
  }, [settings.globalAIEnabled, settings.perGameAI, currentGameId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f') return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(
    () =>
      engine.profile.events.on('changed', () => {
        setProfileTick((value) => value + 1);
      }),
    [engine.profile.events],
  );

  useEffect(
    () =>
      engine.achievements.events.on('unlocked', () => {
        setAchievementTick((value) => value + 1);
      }),
    [engine.achievements.events],
  );

  useEffect(() => {
    if (!settings.debugOverlay) return;
    const timer = window.setInterval(() => {
      setDebugTick((value) => value + 1);
    }, 250);
    return () => window.clearInterval(timer);
  }, [settings.debugOverlay]);

  const toggleGlobalAI = () => {
    setSettings({ globalAIEnabled: !settings.globalAIEnabled });
  };

  const toggleCurrentGameAI = () => {
    if (!currentGameId) return;
    const enabled = settings.perGameAI[currentGameId] ?? settings.globalAIEnabled;
    setPerGameAI(currentGameId, !enabled);
  };

  const mainContent = (() => {
    if (screen === 'settings') {
      return (
        <Card className="screen-card">
          <h2>Settings</h2>
          <SettingsMenu settings={settings} onUpdate={setSettings} onGameAIChange={setPerGameAI} />
        </Card>
      );
    }

    if (screen === 'profile') {
      return (
        <div className="stack-col">
          <Card className="screen-card">
            <h2>Profile</h2>
            <ProfileScreen profile={engine.profile.get()} key={`profile-${profileTick}`} />
          </Card>
          <Card className="screen-card">
            <h2>Achievements</h2>
            <AchievementScreen achievements={engine.achievements.list()} key={`ach-${achievementTick}`} />
          </Card>
        </div>
      );
    }

    if (screen === 'achievements') {
      return (
        <Card className="screen-card">
          <h2>Achievements</h2>
          <AchievementScreen achievements={engine.achievements.list()} key={`ach-screen-${achievementTick}`} />
        </Card>
      );
    }

    if (screen === 'game' && currentGameId) {
      const gameAIEnabled = settings.perGameAI[currentGameId] ?? settings.globalAIEnabled;
      return (
        <div className="game-screen">
          <div className="game-toolbar">
            <Button variant="secondary" onClick={closeGame}>
              Back
            </Button>
            <div className="game-title">{currentGameId}</div>
            <Button variant={gameAIEnabled ? 'primary' : 'ghost'} onClick={toggleCurrentGameAI}>
              AI {gameAIEnabled ? 'On' : 'Off'}
            </Button>
          </div>
          <div className="game-canvas-wrap">
            <canvas ref={canvasRef} id="game-canvas" className="game-canvas" width={900} height={506} />
          </div>
          <div className="game-note">Tap to interact. Press F for fullscreen, Esc to exit.</div>
        </div>
      );
    }

    return (
      <div className="stack-col">
        <Tabs tabs={tabs} current={menuTab} onChange={setMenuTab} />
        {menuTab === 'games' ? (
          <MainMenu games={GAME_META} onSelectGame={openGame} />
        ) : (
          <Card className="screen-card">
            <AchievementScreen achievements={engine.achievements.list()} key={`ach-tab-${achievementTick}`} />
          </Card>
        )}
      </div>
    );
  })();

  return (
    <>
      <ArcadeShell
        header={
          <HeaderBar
            onOpenSettings={() => setScreen('settings')}
            onOpenProfile={() => setScreen('profile')}
            aiEnabled={settings.globalAIEnabled}
            onToggleAI={toggleGlobalAI}
          />
        }
        main={mainContent}
        footer={<FooterBar />}
      />
      <DebugOverlay
        key={`debug-${debugTick}`}
        visible={settings.debugOverlay}
        gameId={currentGameId}
        aiRunning={Boolean(currentGameId && engine.ai.isRunning(currentGameId))}
        particleCount={engine.particles.count}
      />
    </>
  );
}

export function App(): JSX.Element {
  return (
    <ArcadeProvider>
      <ArcadeApp />
    </ArcadeProvider>
  );
}
