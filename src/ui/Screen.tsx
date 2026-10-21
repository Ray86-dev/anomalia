import type { ReactNode } from 'react';

type ScreenProps = {
  readonly title: string;
  readonly children: ReactNode;
  readonly kicker?: string;
};

/** Pantalla móvil a altura completa con márgenes de safe area. */
export function Screen({ title, kicker, children }: ScreenProps) {
  return (
    <main className="screen">
      <header className="screen-header">
        {kicker !== undefined && <p className="kicker">{kicker}</p>}
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}
