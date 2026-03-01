interface ArcadeShellProps {
  header: React.ReactNode;
  main: React.ReactNode;
  footer: React.ReactNode;
}

export function ArcadeShell({ header, main, footer }: ArcadeShellProps): JSX.Element {
  return (
    <div className="arcade-shell">
      {header}
      <main className="arcade-main">{main}</main>
      {footer}
    </div>
  );
}
