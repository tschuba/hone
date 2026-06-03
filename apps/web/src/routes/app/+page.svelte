<script lang="ts">
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";

const authSession = useAuthSession();
</script>

<section
	style="padding: var(--space-6); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); display: grid; gap: var(--space-5);"
>
	<div style="display: grid; gap: var(--space-2);">
		<p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Protected area</p>
		<h1 style="margin: 0; font-size: clamp(1.5rem, 5vw, 2.5rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em; line-height: 1.05;">
			Authenticated app shell
		</h1>
		<p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; max-width: 36rem;">
			The route guard now lives in the <code>/app</code> layout, so protected pages can focus on actual app content instead of redirect plumbing.
		</p>
	</div>

	{#if !authSession.isReady}
		<p style="margin: 0; color: var(--color-text-secondary);">Checking session…</p>
	{:else if authSession.isAuthenticated}
		<div style="display: grid; gap: var(--space-3); padding: var(--space-4); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); background: rgba(255,255,255,0.05);">
			<p style="margin: 0; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Signed in user</p>
			<p style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text-primary);">{authSession.userId}</p>
			<p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; font-size: 0.9rem;">
				The next Sprint 1 and Sprint 6 pages can now sit under this layout and inherit the same authenticated shell and redirect behavior.
			</p>
		</div>
	{/if}
</section>
