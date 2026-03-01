interface EvaluationBarProps {
  value: number;
}

export function EvaluationBar({ value }: EvaluationBarProps): JSX.Element {
  const clamped = Math.max(-12, Math.min(12, value));
  const whitePct = Math.round(((clamped + 12) / 24) * 100);

  return (
    <div className="chess-eval-bar">
      <div className="white" style={{ height: `${whitePct}%` }} />
      <div className="black" style={{ height: `${100 - whitePct}%` }} />
      <div className="label">{value.toFixed(2)}</div>
    </div>
  );
}
