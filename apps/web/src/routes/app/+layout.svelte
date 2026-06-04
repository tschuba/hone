<script lang="ts">
import { goto } from "$app/navigation";

import { useAuthSession } from "$lib/context/auth-session.svelte.ts";

const authSession = useAuthSession();
const { children } = $props();

async function handleLogout() {
  try {
    await authSession.logout();
    await goto("/");
  } catch {
    // The auth session context stores the displayable error state.
  }
}

$effect(() => {
  if (authSession.isReady && !authSession.isAuthenticated) {
    goto("/");
  }
});
</script>

<div style="min-height: 100vh; padding: calc(var(--safe-top) + var(--space-4)) var(--space-4) calc(var(--safe-bottom) + var(--space-6));">
	<div style="max-width: 56rem; margin: 0 auto; display: grid; gap: var(--space-4);">
		<header style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; padding: var(--space-2) 0;">
			<p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
				Hone{#if authSession.isAuthenticated} · {authSession.userId}{#if authSession.isUsingOfflineSession} · offline cache{/if}{:else if !authSession.isReady} · checking session…{/if}
			</p>
			<div style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center;">
				<a href="/" style="text-decoration: none; color: var(--color-text-secondary); font-weight: 600; font-size: 0.875rem;">← Home</a>
				<button
					type="button"
					onclick={handleLogout}
					disabled={!authSession.isAuthenticated || authSession.isSubmitting}
					style="padding: 0.6rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; font-size: 0.875rem; cursor: pointer;"
				>
					{authSession.isSubmitting ? "Signing out…" : "Sign out"}
				</button>
			</div>
		</header>

		{#if authSession.error}
			<p style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.35); color: var(--color-error);">
				{authSession.error}
			</p>
		{/if}

		{@render children()}
	</div>
</div>