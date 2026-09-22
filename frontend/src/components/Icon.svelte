<script lang="ts">
  let { name }: { name: 'refresh' | 'light' | 'dark' | 'system' | 'chevron' } = $props();
</script>

<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'refresh'}
    <path d="M3 12a9 9 0 0 1 15.364-6.364L21 8m0-5v5h-5M21 12a9 9 0 0 1-15.364 6.364L3 16m5 0H3v5" />
  {:else if name === 'light'}
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  {:else if name === 'dark'}
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  {:else if name === 'system'}
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
  {:else}
    <path d="m6 9 6 6 6-6" />
  {/if}
</svg>

<style>svg { display: block; width: 16px; height: 16px; flex: none; }</style>
