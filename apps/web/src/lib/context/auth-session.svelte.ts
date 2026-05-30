import { getContext, setContext } from "svelte";

import { api, setUnauthorizedHandler } from "$lib/api";
import { offlineStore } from "$lib/db/offline-store";
import {
  createOfflineUnavailableError,
  getErrorStatus,
  isBackendUnavailableError,
} from "$lib/network-errors";

const AUTH_SESSION_KEY = Symbol("auth-session");

type AuthError = {
  status?: number;
  title?: string;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "title" in error) {
    const title = error.title;

    if (typeof title === "string" && title.length > 0) {
      return title;
    }
  }

  return "Something went wrong. Please try again.";
}

class AuthSessionContext {
  error = $state<string | null>(null);
  isReady = $state(false);
  isSubmitting = $state(false);
  isUsingOfflineSession = $state(false);
  userId = $state<string | null>(null);

  get isAuthenticated() {
    return this.userId !== null;
  }

  constructor() {
    setUnauthorizedHandler(() => {
      this.userId = null;
      this.isUsingOfflineSession = false;
      void offlineStore.clearCachedAuthUserId().catch((error) => {
        console.error("Failed to clear cached auth state", error);
      });

      if (this.isReady && !this.isSubmitting) {
        this.error = null;
      }
    });
  }

  async initialize() {
    const cachedUserId = await offlineStore.getCachedAuthUserId();

    try {
      await api.initCsrf();

      const currentUser = await api.getCurrentUser();
      this.userId = currentUser.userId;
      this.isUsingOfflineSession = false;
      this.error = null;
      await offlineStore.setCachedAuthUserId(currentUser.userId);
    } catch (error) {
      if (getErrorStatus(error) === 401) {
        await offlineStore.clearCachedAuthUserId();
        this.userId = null;
        this.isUsingOfflineSession = false;
      } else if (isBackendUnavailableError(error) && cachedUserId) {
        this.userId = cachedUserId.value;
        this.isUsingOfflineSession = true;
        this.error = null;
      } else if (isBackendUnavailableError(error)) {
        this.userId = null;
        this.isUsingOfflineSession = false;
        this.error = getErrorMessage(
          createOfflineUnavailableError(
            "Offline session restore is not available yet. Reconnect once to restore your session on this device.",
          ),
        );
      } else {
        this.error = getErrorMessage(error);
        this.userId = null;
        this.isUsingOfflineSession = false;
      }
    } finally {
      this.isReady = true;
    }
  }

  async login(email: string, password: string) {
    this.isSubmitting = true;
    this.error = null;

    try {
      await api.login(email, password);
      const currentUser = await api.getCurrentUser();

      this.userId = currentUser.userId;
      this.isUsingOfflineSession = false;
      await offlineStore.setCachedAuthUserId(currentUser.userId);
    } catch (error) {
      this.userId = null;
      this.isUsingOfflineSession = false;
      this.error = getErrorMessage(error);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  }

  async logout() {
    this.isSubmitting = true;
    this.error = null;

    try {
      await api.logout();
      this.userId = null;
      this.isUsingOfflineSession = false;
      await offlineStore.clearCachedAuthUserId();
    } catch (error) {
      this.error = getErrorMessage(error);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  }

  async register(email: string, password: string) {
    this.isSubmitting = true;
    this.error = null;

    try {
      await api.register(email, password);
      const currentUser = await api.getCurrentUser();

      this.userId = currentUser.userId;
      this.isUsingOfflineSession = false;
      await offlineStore.setCachedAuthUserId(currentUser.userId);
    } catch (error) {
      this.userId = null;
      this.isUsingOfflineSession = false;
      this.error = getErrorMessage(error);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  }
}

export function createAuthSession() {
  return setContext(AUTH_SESSION_KEY, new AuthSessionContext());
}

export function useAuthSession() {
  return getContext<AuthSessionContext>(AUTH_SESSION_KEY);
}
