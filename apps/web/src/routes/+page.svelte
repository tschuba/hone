<script lang="ts">
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";

const authSession = useAuthSession();

// biome-ignore lint/style/useConst: Svelte $state values bound in the template must remain mutable.
let email = $state("demo@hone.local");
// biome-ignore lint/style/useConst: Svelte $state values bound in the template must remain mutable.
let password = $state("password12345");

async function handleLogin() {
  try {
    await authSession.login(email, password);
  } catch {
    // The auth context stores the displayable error state.
  }
}

async function handleRegister() {
  try {
    await authSession.register(email, password);
  } catch {
    // The auth context stores the displayable error state.
  }
}

async function handleLogout() {
  try {
    await authSession.logout();
  } catch {
    // The auth context stores the displayable error state.
  }
}
</script>

<main style="padding: calc(var(--safe-top) + var(--space-6)) var(--space-4) calc(var(--safe-bottom) + var(--space-6));">
  <section
    style="max-width: 46rem; margin: 0 auto; padding: var(--space-6); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: grid; gap: var(--space-6);"
  >
    <div style="display: grid; gap: var(--space-2);">
      <p style="margin: 0; color: var(--color-accent); font-weight: 600;">Hone MVP</p>
      <h1 style="margin: 0; font-size: clamp(2rem, 8vw, 3.5rem); line-height: 1.05;">
        Sprint 1 auth bootstrap
      </h1>
      <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; max-width: 38rem;">
        The client now initializes CSRF automatically and can exercise the local auth flow while the rest of the training UI is still being built.
      </p>
    </div>

    <div style="display: grid; gap: var(--space-4);">
      <div
        style="display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: center; justify-content: space-between; padding: var(--space-4); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.03);"
      >
        <div style="display: grid; gap: var(--space-2);">
          <p style="margin: 0; color: var(--color-text-muted); font-size: 0.95rem;">Auth status</p>
          {#if !authSession.isReady}
            <p style="margin: 0; font-weight: 600;">Initializing session…</p>
          {:else if authSession.isAuthenticated}
            <p style="margin: 0; font-weight: 600;">Signed in as {authSession.userId}</p>
          {:else}
            <p style="margin: 0; font-weight: 600;">Not signed in</p>
          {/if}
        </div>

        {#if authSession.isAuthenticated}
          <button
            type="button"
            onclick={handleLogout}
            disabled={authSession.isSubmitting}
            style="padding: 0.8rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer;"
          >
            {authSession.isSubmitting ? "Signing out…" : "Sign out"}
          </button>
        {/if}
      </div>

      {#if authSession.isAuthenticated}
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
          <a
            href="/app"
            style="display: inline-flex; width: fit-content; align-items: center; gap: 0.5rem; padding: 0.9rem 1.1rem; border-radius: var(--radius-md); background: rgba(252, 211, 77, 0.12); border: 1px solid rgba(252, 211, 77, 0.35); text-decoration: none; font-weight: 700;"
          >
            Open protected app area
          </a>

          <a
            href="/onboarding"
            style="display: inline-flex; width: fit-content; align-items: center; gap: 0.5rem; padding: 0.9rem 1.1rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); border: 1px solid var(--color-border-subtle); text-decoration: none; font-weight: 700; color: inherit;"
          >
            Complete onboarding
          </a>
        </div>
      {/if}

      <div style="display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
        <label style="display: grid; gap: var(--space-2);">
          <span style="color: var(--color-text-muted); font-size: 0.95rem;">Email</span>
          <input
            type="email"
            bind:value={email}
            autocomplete="email"
            style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
          />
        </label>

        <label style="display: grid; gap: var(--space-2);">
          <span style="color: var(--color-text-muted); font-size: 0.95rem;">Password</span>
          <input
            type="password"
            bind:value={password}
            autocomplete="current-password"
            style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
          />
        </label>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: var(--space-4);">
        <button
          type="button"
          onclick={handleLogin}
          disabled={authSession.isSubmitting || !authSession.isReady}
          style="padding: 0.9rem 1.1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer;"
        >
          {authSession.isSubmitting ? "Working…" : "Sign in"}
        </button>

        <button
          type="button"
          onclick={handleRegister}
          disabled={authSession.isSubmitting || !authSession.isReady}
          style="padding: 0.9rem 1.1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
        >
          {authSession.isSubmitting ? "Working…" : "Create account"}
        </button>
      </div>

      {#if authSession.error}
        <p
          style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248, 113, 113, 0.14); border: 1px solid rgba(248, 113, 113, 0.35); color: var(--color-error);"
        >
          {authSession.error}
        </p>
      {/if}
    </div>
  </section>
</main>