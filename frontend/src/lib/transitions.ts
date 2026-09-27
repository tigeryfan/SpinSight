import { cubicOut } from 'svelte/easing';
import { slide } from 'svelte/transition';

export function cardTransition(node: Element) {
  return slide(node, {
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
    easing: cubicOut,
  });
}
