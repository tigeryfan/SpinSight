<script lang="ts">
  import type { Dorm } from '../lib/types';
  import { setSelectedDormId } from '../lib/state.svelte';

  interface Props {
    dorms: Dorm[];
    selectedId: string;
  }
  let { dorms, selectedId }: Props = $props();

  function onChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    setSelectedDormId(value);
  }
</script>

<div class="wrap">
  <label class="label mono" for="dorm-select">DORM</label>
  <div class="select-row">
    <select
      id="dorm-select"
      class="dorm-select mono"
      value={selectedId}
      onchange={onChange}
    >
      {#each dorms as dorm (dorm.id)}
        <option value={dorm.id}>{dorm.name}</option>
      {/each}
    </select>
    <svg class="caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" stroke-width="1.25" />
    </svg>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 260px;
  }

  .label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.16em;
    color: var(--text-faint);
  }

  .select-row {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid var(--ink-3);
    background: var(--ink-2);
    transition: border-color 120ms ease;
  }

  .select-row:hover,
  .select-row:focus-within {
    border-color: var(--text-dim);
  }

  .dorm-select {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: 0;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.04em;
    padding: 10px 36px 10px 14px;
    width: 100%;
    cursor: pointer;
  }

  .dorm-select option {
    background: var(--ink-2);
    color: var(--text);
  }

  .caret {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    pointer-events: none;
  }

  @media (max-width: 720px) {
    .wrap {
      max-width: none;
    }
  }
</style>
