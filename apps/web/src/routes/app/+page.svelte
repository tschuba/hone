<script lang="ts">
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";

const authSession = useAuthSession();
</script>

<section
	style="padding: var(--space-6); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: grid; gap: var(--space-6);"
>
	<div style="display: grid; gap: var(--space-2);">
		<p style="margin: 0; color: var(--color-accent); font-weight: 600;">Protected area</p>
		<h1 style="margin: 0; font-size: clamp(1.8rem, 6vw, 3rem); line-height: 1.05;">
			Authenticated app shell
		</h1>
		<p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; max-width: 36rem;">
			The route guard now lives in the `/app` layout, so protected pages can focus on actual app content instead of redirect plumbing.
		</p>
	</div>

	{#if !authSession.isReady}
		<p style="margin: 0; color: var(--color-text-secondary);">Checking session…</p>
	{:else if authSession.isAuthenticated}
		<div style="display: grid; gap: var(--space-4); padding: var(--space-4); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.03);">
			<p style="margin: 0; color: var(--color-text-muted);">Signed in user</p>
			<p style="margin: 0; font-size: 1.1rem; font-weight: 700;">{authSession.userId}</p>
			<p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6;">
				The next Sprint 1 and Sprint 6 pages can now sit under this layout and inherit the same authenticated shell and redirect behavior.
			</p>
		</div>
	{/if}
</section>
