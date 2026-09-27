import { cubicOut } from 'svelte/easing';
import { slide } from 'svelte/transition';

export function cardTransition(node: Element) {
  const { marginTop, marginBottom } = getComputedStyle(node);
  const transition = slide(node, {
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
    easing: cubicOut,
  });
  return {
    ...transition,
    // Keep the gap between cards until the collapsed card leaves the DOM.
    css: (t: number, u: number) => `${transition.css!(t, u)}; margin-top: ${marginTop}; margin-bottom: ${marginBottom};`,
  };
}
