<script lang="ts">
  import SelectMenu from './SelectMenu.svelte';
  let { value = $bindable('All Dorms'), dorms, highlighted = false, onSelect }: { value?: string; dorms: string[]; highlighted?: boolean; onSelect?: (dorm: string) => void } = $props();
  let options = $derived(['All Dorms', ...dorms].map(dorm => ({ value: dorm, label: dorm })));
</script>

<SelectMenu bind:value {options} {onSelect} {highlighted} label="Dorm" id="dorm-menu" />
