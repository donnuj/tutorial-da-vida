const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tdv_access_token') : null;

  const res = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry once with new token
      const newToken = localStorage.getItem('tdv_access_token');
      const retry = await fetch(BASE + path, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!retry.ok) throw new ApiError(retry.status, await retry.json().catch(() => ({})));
      return retry.json() as Promise<T>;
    }
    throw new ApiError(401, { message: 'Sessão expirada. Faça login novamente.' });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('tdv_access_token', data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(String(body?.message ?? `HTTP ${status}`));
  }
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; profile: { id: number; username: string; email: string; hasCharacter: boolean } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (email: string, username: string, password: string) =>
    request<{ accessToken: string; profile: { id: number; username: string; email: string; hasCharacter: boolean } }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) }
    ),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

// Character
export const character = {
  create: (name: string) =>
    request<CharacterState>('/character', { method: 'POST', body: JSON.stringify({ name }) }),
  getState: () =>
    request<CharacterState>('/character/state'),
  performAction: (action: string, targetId?: string, targetLocationId?: string) =>
    request<CharacterState>('/character/action', {
      method: 'POST',
      body: JSON.stringify({ action, targetId, targetLocationId }),
    }),
  downloadSave: () =>
    request<{ revision: number; data: unknown }>('/character/save'),
  uploadSave: (revision: number, data: unknown) =>
    request<{ revision: number; checksum: string }>('/character/save', {
      method: 'PUT',
      body: JSON.stringify({ revision, data }),
    }),
};

// Simulation
export const simulation = {
  offlineProgress: () =>
    request<OfflineProgressResult>('/simulation/offline-progress', { method: 'POST' }),
  advanceToAdult: (traitDeltas: Record<string, number>) =>
    request<void>('/simulation/advance-to-adult', {
      method: 'POST',
      body: JSON.stringify({ traitDeltas }),
    }),
};

// Types matching backend responses
export interface CharacterState {
  id: number;
  name: string;
  generation: number;
  alive: boolean;
  gameAge: number;
  phase: string;
  intelligence: number;
  education: number;
  discipline: number;
  health: number;
  energy: number;
  happiness: number;
  stress: number;
  sociability: number;
  reputation: number;
  financialKnowledge: number;
  money: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  locationId: string;
  currentActivity: string | null;
  activityEndsAt: string | null;
  jobId: string | null;
  jobTitle: string | null;
  jobExperience: number;
  studyProgress: number;
  studyTarget: string | null;
}

export interface OfflineProgressResult {
  timeElapsedMinutes: number;
  moneyEarned: number;
  moneySpent: number;
  energyChange: number;
  events: { type: string; description: string; delta: Record<string, number> }[];
}
