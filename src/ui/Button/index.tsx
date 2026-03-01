import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps): JSX.Element {
  return <button className={`ui-button ${variant} ${className}`.trim()} {...props} />;
}
