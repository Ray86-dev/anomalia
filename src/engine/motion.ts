/** Movimiento reducido: preferencia del sistema o la opción manual `html[data-motion="reduced"]`. */
export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.motion === 'reduced'
  );
}

/** Entrada suave de una pantalla (GSAP se carga bajo demanda; sin animación si hay movimiento reducido). */
export async function animateIn(element: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return;
  const { gsap } = await import('gsap');
  gsap.fromTo(
    element,
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform' },
  );
}

/** Cuenta de un número a otro (el año del viaje temporal). Devuelve una función para cancelarla. */
export async function countTo(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  seconds = 2.4,
): Promise<() => void> {
  if (prefersReducedMotion()) {
    onUpdate(to);
    return () => undefined;
  }
  const { gsap } = await import('gsap');
  const state = { value: from };
  const tween = gsap.to(state, {
    value: to,
    duration: seconds,
    ease: 'power3.inOut',
    onUpdate: () => {
      onUpdate(Math.round(state.value));
    },
  });
  return () => {
    tween.kill();
  };
}

/** Vibración breve en momentos clave (solo Android; en iOS no hace nada). */
export function vibrate(ms = 30): void {
  try {
    navigator.vibrate(ms);
  } catch {
    // No disponible: degradación silenciosa (§10.1).
  }
}
