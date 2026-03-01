import React from 'react';

interface ToggleProps {
  checked: boolean;
  label?: string;
  onChange: (checked: boolean) => void;
}

export function Toggle({ checked, label, onChange }: ToggleProps): JSX.Element {
  return (
    <label className="ui-toggle">
      <span>{label}</span>
      <button
        type="button"
        className={`ui-toggle-btn ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </label>
  );
}
