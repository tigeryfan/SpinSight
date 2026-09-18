<script lang="ts">
  import { bumpSeed } from '../lib/state.svelte';

  let spinning = $state(false);

  function onClick() {
    if (spinning) return;
    spinning = true;
    bumpSeed();
    setTimeout(() => {
      spinning = false;
    }, 420);
  }
</script>

<button
  type="button"
  class="refresh"
  onclick={onClick}
  aria-label="Refresh mock data"
  title="Refresh"
>
  <span class="glyph" class:spin={spinning} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M20.5 12a8.5 8.5 0 0 0-14.7-5.7" />
      <path d="M19 3v4h-4" />
      <path d="M3.5 12a8.5 8.5 0 0 0 14.7 5.7" />
      <path d="M5 21v-4h4" />
    </svg>
  </span>
  <span class="caption mono">REFRESH</span>
</button>

<style>
  .refresh {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--ink-3);
    background: var(--ink-2);
    color: var(--text);
    padding: 10px 14px 10px 12px;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      color 120ms ease;
  }

  .refresh:hover {
    border-color: var(--text-dim);
    color: var(--text);
  }

  .refresh:active {
    border-color: var(--text);
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
    transition: transform 80ms ease;
    transform-origin: 50% 50%;
  }

  .glyph.spin {
    animation: spin 420ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .caption {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--text-dim);
  }

  @media (max-width: 720px) {
    .refresh {
      padding: 8px 12px;
    }
    .caption {
      font-size: 9px;
    }
  }
</style>
