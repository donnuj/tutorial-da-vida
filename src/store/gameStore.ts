import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface CharacterState {
  id: number;
  name: string;
  phase: string;
  gameAge: number;
  energy: number;
  happiness: number;
  stress: number;
  health: number;
  money: number;
  monthlyIncome: number;
  currentActivity: string | null;
  activityEndsAt: string | null;
  locationId: string;
  jobTitle: string | null;
}

export interface PendingAction {
  buildingId: string;
  action: string;
}

interface GameStore {
  character: CharacterState | null;
  gameTimeMinutes: number;
  nearbyBuildingId: string | null;
  pendingAction: PendingAction | null;
  accessToken: string | null;
  isLoaded: boolean;

  setCharacter: (c: CharacterState) => void;
  updateCharacter: (partial: Partial<CharacterState>) => void;
  setGameTime: (minutes: number) => void;
  setNearbyBuilding: (id: string | null) => void;
  triggerAction: (action: PendingAction) => void;
  clearPendingAction: () => void;
  setAccessToken: (token: string | null) => void;
  setLoaded: (v: boolean) => void;

  // Derived
  getHour: () => number;
  getAgeYears: () => number;
  getTimeString: () => string;
  getAgeString: () => string;
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    character: null,
    gameTimeMinutes: 0,
    nearbyBuildingId: null,
    pendingAction: null,
    accessToken: null,
    isLoaded: false,

    setCharacter: (c) => set((s) => { s.character = c; }),

    updateCharacter: (partial) => set((s) => {
      if (s.character) Object.assign(s.character, partial);
    }),

    setGameTime: (minutes) => set((s) => {
      s.gameTimeMinutes = minutes;
      if (s.character) s.character.gameAge = minutes;
    }),

    setNearbyBuilding: (id) => set((s) => { s.nearbyBuildingId = id; }),

    triggerAction: (action) => set((s) => { s.pendingAction = action; }),

    clearPendingAction: () => set((s) => { s.pendingAction = null; }),

    setAccessToken: (token) => set((s) => { s.accessToken = token; }),

    setLoaded: (v) => set((s) => { s.isLoaded = v; }),

    getHour: () => Math.floor(get().gameTimeMinutes / 60) % 24,

    getAgeYears: () => Math.floor(get().gameTimeMinutes / (60 * 24 * 365)),

    getTimeString: () => {
      const m = get().gameTimeMinutes;
      const h = String(Math.floor(m / 60) % 24).padStart(2, '0');
      const min = String(m % 60).padStart(2, '0');
      return `${h}:${min}`;
    },

    getAgeString: () => {
      const years = Math.floor(get().gameTimeMinutes / (60 * 24 * 365));
      const months = Math.floor((get().gameTimeMinutes % (60 * 24 * 365)) / (60 * 24 * 30));
      if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
      return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    },
  }))
);
