import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvestigationState {
  /** null = unsaved / new investigation */
  id: string | null;
  title: string;
  organizationIds: string[];
  queryState: Record<string, unknown>;
  isPublic: boolean;

  // ---------------------------------------------------------------------------
  // Actions (pure state mutations — async save/load is handled by the page
  // via tRPC hooks so we avoid importing React hooks into a Zustand store)
  // ---------------------------------------------------------------------------
  addOrganization: (id: string) => void;
  removeOrganization: (id: string) => void;
  setTitle: (title: string) => void;
  setPublic: (isPublic: boolean) => void;
  setQueryState: (key: string, value: unknown) => void;
  /** Called after a successful server save to update the local id */
  setSavedId: (id: string) => void;
  /** Hydrate state from a loaded investigation record */
  hydrate: (record: InvestigationRecord) => void;
  reset: () => void;
}

export interface InvestigationRecord {
  id: string;
  title: string;
  organizationIds: string[];
  queryState: Record<string, unknown>;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE = {
  id: null as string | null,
  title: 'Untitled Investigation',
  organizationIds: [] as string[],
  queryState: {} as Record<string, unknown>,
  isPublic: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInvestigationStore = create<InvestigationState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      addOrganization(id) {
        set((state) => {
          if (state.organizationIds.includes(id)) return state;
          return { organizationIds: [...state.organizationIds, id] };
        });
      },

      removeOrganization(id) {
        set((state) => ({
          organizationIds: state.organizationIds.filter((oid) => oid !== id),
        }));
      },

      setTitle(title) {
        set({ title });
      },

      setPublic(isPublic) {
        set({ isPublic });
      },

      setQueryState(key, value) {
        set((state) => ({
          queryState: { ...state.queryState, [key]: value },
        }));
      },

      setSavedId(id) {
        set({ id });
      },

      hydrate(record) {
        set({
          id: record.id,
          title: record.title,
          organizationIds: record.organizationIds,
          queryState: record.queryState,
          isPublic: record.isPublic,
        });
      },

      reset() {
        set({ ...DEFAULT_STATE });
      },
    }),
    {
      name: 'opengive-investigation',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            },
      ),
      // Persist only data fields, not any ephemeral UI state
      partialize: (state) => ({
        id: state.id,
        title: state.title,
        organizationIds: state.organizationIds,
        queryState: state.queryState,
        isPublic: state.isPublic,
      }),
    },
  ),
);
