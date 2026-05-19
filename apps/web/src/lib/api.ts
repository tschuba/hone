type ApiError = {
  status?: number;
  title?: string;
};

let unauthorizedHandler: (() => void) | null = null;

type RequestBody = BodyInit | Record<string, unknown> | null | undefined;

type RequestOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  body?: RequestBody;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

type AuthUser = {
  userId: string;
};

type CsrfResponse = {
  csrfToken: string;
};

function readCsrfTokenFromCookie() {
  return document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)?.[1] ?? null;
}

function isJsonBody(body: RequestBody): body is Record<string, unknown> {
  return (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  );
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const csrfToken = readCsrfTokenFromCookie();
  const method = init.method ?? "GET";
  const body = isJsonBody(init.body) ? JSON.stringify(init.body) : init.body;

  if (!headers.has("content-type") && isJsonBody(init.body)) {
    headers.set("content-type", "application/json");
  }

  if (["DELETE", "PATCH", "POST", "PUT"].includes(method)) {
    headers.set("x-csrf-token", csrfToken ?? "");
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    body,
    credentials: "same-origin",
    headers,
    method,
  });

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    let errorBody: ApiError | null = null;

    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      errorBody = null;
    }

    throw {
      status: response.status,
      title: errorBody?.title ?? response.statusText,
    } satisfies ApiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function initCsrf() {
  const response = await request<CsrfResponse>("/auth/csrf");
  return response.csrfToken;
}

export const api = {
  getCurrentUser() {
    return request<AuthUser>("/auth/me");
  },
  initCsrf,
  login(email: string, password: string) {
    return request<{ ok: true }>("/auth/login", {
      body: { email, password },
      method: "POST",
    });
  },
  logout() {
    return request<{ ok: true }>("/auth/logout", {
      method: "POST",
    });
  },
  register(email: string, password: string) {
    return request<{ email: string; id: string }>("/auth/register", {
      body: { email, password },
      method: "POST",
    });
  },
  request,
};
