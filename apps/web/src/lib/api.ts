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

type EquipmentPool = {
  id: string;
  name: string;
  tags: string[];
};

type ActiveWorkoutExercise = {
  completedSets: number;
  durationSecs: number | null;
  exerciseId: string;
  exerciseLogId: string | null;
  imageAltText: string;
  imageUrl: string | null;
  name: string;
  position: number;
  reps: number | null;
  restSecs: number;
  sets: number;
  substitutedForExerciseId: string | null;
  substitutedForName: string | null;
};

type ActiveWorkout =
  | { status: "empty" }
  | {
      exercises: ActiveWorkoutExercise[];
      mesocyclusId: string | null;
      sessionId: string;
      status: "active_session";
      templateId: string;
      templateLabel: string;
      templateTitle: string | null;
    }
  | {
      exercises: ActiveWorkoutExercise[];
      mesocyclusId: string;
      sessionId: null;
      status: "planned";
      templateId: string;
      templateLabel: string;
      templateTitle: string | null;
    };

type StartedWorkoutSession = {
  exerciseLogs: Array<{
    exerciseId: string;
    id: string;
    position: number;
  }>;
  id: string;
  status: string;
  templateId: string | null;
};

type WorkoutHistoryItem = {
  completedAt: string | null;
  id: string;
  startedAt: string;
  status: string;
  templateId: string | null;
};

type CreatePlanResponse = {
  jobId: string;
  mesocyclusId: string;
  planSource: "rule_based";
  status: "queued";
};

type ActivePlanExercise = {
  durationSecs: number | null;
  name: string;
  reps: number | null;
  sets: number;
};

type ActivePlanSession = {
  exercises: ActivePlanExercise[];
  isNext: boolean;
  position: number;
};

type ActivePlan = {
  completedSessions: number;
  cycleCount: number;
  equipmentPoolId: string | null;
  mesocyclusId: string;
  name: string;
  sessionMinutes: number;
  sessions: ActivePlanSession[];
  sessionsPerCycle: number;
  totalSessions: number;
};

type SetPayload = {
  durationSecs?: number;
  exerciseLogId: string;
  reps?: number;
  setNr: number;
  uuid: string;
};

type ExerciseSubstitutionCandidate = {
  id: string;
  imageAltText: string;
  imageUrl: string | null;
  name: string;
  tags: string[];
};

type ProfileConstraints = {
  impactFilter: boolean;
};

type ProfileGoal = {
  scope: "profile";
  value: string;
};

type UserProfile = {
  constraints: ProfileConstraints;
  goals: ProfileGoal[];
};

type UserDataExport = unknown;

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
  createEquipmentPool(name: string, tags: string[]) {
    return request<EquipmentPool>("/equipment-pools", {
      body: { name, tags },
      method: "POST",
    });
  },
  completeWorkoutSession(sessionId: string) {
    return request<{ completedAt: string; id: string; status: string }>(
      `/workout-sessions/${sessionId}/complete`,
      {
        method: "POST",
      },
    );
  },
  createPlan(input?: {
    cycleCount?: number;
    equipmentPoolId?: string;
    sessionMinutes?: number;
  }) {
    return request<CreatePlanResponse>("/plans", {
      body: input ?? {},
      method: "POST",
    });
  },
  getActivePlan() {
    return request<ActivePlan>("/plans/active");
  },
  getCurrentUser() {
    return request<AuthUser>("/auth/me");
  },
  getActiveWorkout() {
    return request<ActiveWorkout>("/workout/today");
  },
  getProfile() {
    return request<UserProfile>("/users/me");
  },
  exportUserData() {
    return request<UserDataExport>("/users/me/export");
  },
  initCsrf,
  listExerciseSubstitutions(sessionId: string, exerciseLogId: string) {
    return request<{ items: ExerciseSubstitutionCandidate[] }>(
      `/workout-sessions/${sessionId}/exercises/${exerciseLogId}/substitutions`,
    );
  },
  listEquipmentPools() {
    return request<{ items: EquipmentPool[] }>("/equipment-pools");
  },
  listWorkoutHistory() {
    return request<{ items: WorkoutHistoryItem[] }>("/workout-sessions");
  },
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
  logSet(sessionId: string, set: SetPayload) {
    return request<{
      durationSecs: number | null;
      exerciseLogId: string;
      id: string;
      reps: number | null;
      setNr: number;
      uuid: string;
    }>(`/workout-sessions/${sessionId}/sets`, {
      body: set,
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
  skipToday(mesocyclusId: string) {
    return request<{ id: string; status: string }>("/workout-sessions/skip", {
      body: { mesocyclusId },
      method: "POST",
    });
  },
  startSession(
    templateId: string,
    options?: {
      exerciseLogs?: Array<{
        exerciseId: string;
        id: string;
        position: number;
      }>;
      id?: string;
    },
  ) {
    return request<StartedWorkoutSession>("/workout-sessions", {
      body: {
        templateId,
        ...(options?.id ? { id: options.id } : {}),
        ...(options?.exerciseLogs
          ? { exerciseLogs: options.exerciseLogs }
          : {}),
      },
      method: "POST",
    });
  },
  substituteExercise(
    sessionId: string,
    exerciseLogId: string,
    exerciseId: string,
  ) {
    return request<{
      exerciseId: string;
      exerciseLogId: string;
      imageAltText: string;
      imageUrl: string | null;
      name: string;
      substitutedForExerciseId: string | null;
      substitutedForName: string | null;
    }>(`/workout-sessions/${sessionId}/exercises/${exerciseLogId}/substitute`, {
      body: { exerciseId },
      method: "POST",
    });
  },
  submitFeedback(input: {
    difficulty: string;
    mesocyclusId: string;
    variety: string;
  }) {
    return request<{ jobId: string; ok: true }>("/feedback", {
      body: input,
      method: "POST",
    });
  },
  updateEquipmentPool(
    poolId: string,
    input: { name?: string; tags?: string[] },
  ) {
    return request<EquipmentPool>(`/equipment-pools/${poolId}`, {
      body: input,
      method: "PUT",
    });
  },
  updateProfile(input: UserProfile) {
    return request<UserProfile>("/users/me", {
      body: input,
      method: "PUT",
    });
  },
};

export type {
  ActivePlan,
  ActivePlanSession,
  ActiveWorkout,
  ActiveWorkoutExercise,
  CreatePlanResponse,
  ExerciseSubstitutionCandidate,
  EquipmentPool,
  ProfileConstraints,
  ProfileGoal,
  SetPayload,
  StartedWorkoutSession,
  UserProfile,
  UserDataExport,
  WorkoutHistoryItem,
};
