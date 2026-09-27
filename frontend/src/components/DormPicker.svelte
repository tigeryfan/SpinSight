<script lang="ts">
  import SelectMenu from './SelectMenu.svelte';
  let { value = $bindable('All Dorms'), dorms, onSelect }: { value?: string; dorms: string[]; onSelect?: (dorm: string) => void } = $props();
  let options = $derived(['All Dorms', ...dorms].map(dorm => ({ value: dorm, label: dorm })));
</script>

<SelectMenu bind:value {options} {onSelect} label="Dorm" id="dorm-menu" />
