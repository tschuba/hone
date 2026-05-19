import { getContext, setContext } from "svelte";

import { api, setUnauthorizedHandler } from "$lib/api";

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

function getStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as AuthError).status;

    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

class AuthSessionContext {
  error = $state<string | null>(null);
  isReady = $state(false);
  isSubmitting = $state(false);
  userId = $state<string | null>(null);

  get isAuthenticated() {
    return this.userId !== null;
  }

  constructor() {
    setUnauthorizedHandler(() => {
      this.userId = null;

      if (this.isReady && !this.isSubmitting) {
        this.error = null;
      }
    });
  }

  async initialize() {
    try {
      await api.initCsrf();

      const currentUser = await api.getCurrentUser();
      this.userId = currentUser.userId;
      this.error = null;
    } catch (error) {
      if (getStatus(error) !== 401) {
        this.error = getErrorMessage(error);
      }

      this.userId = null;
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
    } catch (error) {
      this.userId = null;
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
    } catch (error) {
      this.userId = null;
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
