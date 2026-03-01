import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children }: CardProps): JSX.Element {
  return <div className={`ui-card ${className}`.trim()}>{children}</div>;
}
