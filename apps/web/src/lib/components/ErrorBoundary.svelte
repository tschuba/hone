<script lang="ts">
type Props = {
  details?: string | null;
  title?: string;
};

const { details = null, title = "Something went wrong." }: Props = $props();
</script>

<section
  role="alert"
  style="padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248, 113, 113, 0.14); border: 1px solid rgba(248, 113, 113, 0.35); color: var(--color-error); display: grid; gap: var(--space-2);"
>
  <strong>{title}</strong>
  {#if details}
    <span>{details}</span>
  {/if}
</section>