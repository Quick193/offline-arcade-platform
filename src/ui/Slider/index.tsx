import React from 'react';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export function Slider({ value, min = 0, max = 1, step = 0.01, onChange }: SliderProps): JSX.Element {
  return (
    <input
      className="ui-slider"
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
