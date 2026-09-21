<script lang="ts">
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { dorms } from '../lib/data';
  import Icon from './Icon.svelte';
  let { value = $bindable('All Dorms') }: { value?: string } = $props();
  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  const options = ['All Dorms', ...dorms];

  function dropdown(node: Element) {
    return fly(node, {
      y: -6,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
      easing: cubicOut,
    });
  }

  async function show() {
    open = true;
    await tick();
    menu?.querySelectorAll('button')[options.indexOf(value)]?.focus();
  }
  function close(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger.focus();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (!open || !menu || !(event.target instanceof HTMLButtonElement)) return;
    const buttons = [...menu.querySelectorAll('button')];
    const index = buttons.indexOf(event.target);
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
  }
</script>

<svelte:window onpointerdown={(event) => { if (open && !root.contains(event.target as Node)) close(); }} />
<div class="dorm-picker" bind:this={root} onfocusout={(event) => { if (!root.contains(event.relatedTarget as Node)) close(); }}>
  <button class="pill" bind:this={trigger} aria-label={`Dorm: ${value}`} aria-haspopup="menu" aria-expanded={open} aria-controls="dorm-menu"
    onclick={() => open ? close() : show()}
    onkeydown={(event) => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); } }}>
    <span class="dorm-dot" aria-hidden="true"></span><span>{value}</span><Icon name="chevron" />
  </button>
  {#if open}
    <div id="dorm-menu" class="dorm-menu" role="menu" tabindex="-1" aria-label="Dorm" inert={!open} transition:dropdown bind:this={menu} onkeydown={keydown}>
      {#each options as dorm}
        <button role="menuitemradio" aria-checked={value === dorm} tabindex="-1" onclick={() => { value = dorm; close(true); }}>
          {dorm}
          {#if value === dorm}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dorm-picker { position: relative; }
  .dorm-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .dorm-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 20; min-width: 190px; padding: 4px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--popover-shadow); }
  .dorm-menu button { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 10px; border: 0; border-radius: 4px; background: transparent; color: var(--ink); text-align: left; }
  .dorm-menu button:hover { background: var(--bg); }
  .dorm-menu button[aria-checked='true'] { background: var(--selected); color: var(--selected-ink); }
  .dorm-menu svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; }
</style>
