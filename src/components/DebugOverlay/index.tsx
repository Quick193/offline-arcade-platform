interface DebugOverlayProps {
  visible: boolean;
  gameId: string | null;
  aiRunning: boolean;
  particleCount: number;
}

export function DebugOverlay({ visible, gameId, aiRunning, particleCount }: DebugOverlayProps): JSX.Element | null {
  if (!visible) return null;

  return (
    <div className="debug-overlay">
      <div>Game: {gameId ?? 'none'}</div>
      <div>AI: {aiRunning ? 'running' : 'idle'}</div>
      <div>Particles: {particleCount}</div>
      <div>Origin: top-left, +x right, +y down</div>
    </div>
  );
}
