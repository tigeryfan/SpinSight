<script lang="ts">
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import Icon from './Icon.svelte';
  let { value = $bindable(), options, label, id, highlighted = false, onSelect }: { value?: string; options: { value: string; label: string }[]; label: string; id: string; highlighted?: boolean; onSelect?: (value: string) => void } = $props();
  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  let pointerHold = false;
  let draggedOption = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let selectedLabel = $derived(options.find(option => option.value === value)?.label ?? value);

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
    menu?.querySelectorAll('button')[options.findIndex(option => option.value === value)]?.focus();
  }
  function close(restoreFocus = false) {
    open = false;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = undefined;
    pointerHold = false;
    draggedOption = false;
    if (restoreFocus) trigger.focus();
  }
  function startHold() {
    pointerHold = true;
    draggedOption = false;
    holdTimer = setTimeout(() => {
      holdTimer = undefined;
      if (pointerHold) show();
    }, 180);
  }
  function finishPointer(event: PointerEvent) {
    if (!pointerHold) return;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = undefined;
      pointerHold = false;
      return;
    }
    if (!open || !menu) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const option = target instanceof Element ? target.closest<HTMLButtonElement>('[role="menuitemradio"]') : null;
    if (option && menu.contains(option) && draggedOption) {
      option.click();
    } else {
      close(true);
    }
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

<svelte:window onpointerdown={(event) => { if (open && !root.contains(event.target as Node)) close(); }} onpointermove={(event) => {
  if (!pointerHold || !open || !menu) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const option = target instanceof Element ? target.closest('[role="menuitemradio"]') : null;
  if (option && menu.contains(option)) draggedOption = true;
}} onpointerup={finishPointer} onpointercancel={() => { if (pointerHold) close(true); }} />
<div class="select-menu" bind:this={root} onfocusout={(event) => { if (!root.contains(event.relatedTarget as Node)) close(); }}>
  <button class="pill" class:tour-target={highlighted} bind:this={trigger} aria-label={`${label}: ${selectedLabel}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
    onpointerdown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (!open) startHold();
    }}
    onclick={(event) => {
      if (event.detail === 0) open ? close(true) : show();
      else if (!pointerHold) open ? close(true) : show();
    }}
    onkeydown={(event) => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); } }}>
    <span>{selectedLabel}</span><span class="chevron" class:flipped={open}><Icon name="chevron" /></span>
  </button>
  {#if open}
    <div {id} class="select-options" role="menu" tabindex="-1" aria-label={label} inert={!open} transition:dropdown bind:this={menu} onkeydown={keydown}>
      {#each options as option (option.value)}
        <button role="menuitemradio" aria-checked={value === option.value} tabindex="-1" onclick={() => { value = option.value; onSelect?.(option.value); close(true); }}>
          {option.label}
          {#if value === option.value}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3 3 7-7" /></svg>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select-menu { position: relative; }
  .chevron { display: inline-flex; transition: transform 160ms cubic-bezier(.215, .61, .355, 1); }
  .chevron.flipped { transform: rotate(180deg); }
  .select-options { position: absolute; top: calc(100% + 6px); right: 0; z-index: 20; min-width: 190px; padding: var(--control-inset); background: var(--panel); border: 1px solid transparent; border-radius: var(--radius-control); box-shadow: var(--popover-shadow); }
  .select-options button { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 10px; border: 0; border-radius: max(0px, calc(var(--radius-control) - var(--control-inset) - 1px)); background: transparent; color: var(--ink); text-align: left; }
  .select-options button:hover { background: var(--bg); }
  .select-options button[aria-checked='true'] { background: var(--selected); color: var(--selected-ink); }
  .select-options svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  @media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
</style>
