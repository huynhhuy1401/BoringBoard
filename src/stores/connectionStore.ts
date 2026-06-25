import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ConnectionConfig } from '../types/connection';

interface ConnectionState {
  connections: ConnectionConfig[];
  activeId: string | null;
  activeDb: string | null;
  activeSchema: string;
  loading: boolean;
  connecting: boolean;
  testing: boolean;
  fetchConnections: () => Promise<void>;
  saveConnection: (config: ConnectionConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  setActiveDb: (db: string | null) => void;
  setActiveSchema: (schema: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeId: null,
  activeDb: null,
  activeSchema: 'public',
  loading: false,
  connecting: false,
  testing: false,
  fetchConnections: async () => {
    set({ loading: true });
    try {
      const connections = await invoke<ConnectionConfig[]>('list_saved_connections');
      set({ connections, loading: false });
    } catch (err) {
      console.error('Failed to fetch connections', err);
      set({ loading: false });
    }
  },
  saveConnection: async (config) => {
    try {
      await invoke('save_connection', { config });
      await get().fetchConnections();
    } catch (err) {
      console.error('Failed to save connection', err);
      throw err;
    }
  },
  deleteConnection: async (id) => {
    try {
      await invoke('delete_connection', { id });
      if (get().activeId === id) {
        await get().disconnect();
      }
      await get().fetchConnections();
    } catch (err) {
      console.error('Failed to delete connection', err);
    }
  },
  connect: async (config) => {
    set({ connecting: true });
    try {
      await invoke('create_connection', { config });
      set({
        activeId: config.id,
        activeDb: config.database,
        activeSchema: 'public',
        connecting: false,
      });
    } catch (err) {
      set({ connecting: false });
      console.error('Failed to connect to database', err);
      throw err;
    }
  },
  disconnect: async () => {
    const { activeId } = get();
    if (activeId) {
      try {
        await invoke('disconnect', { connectionId: activeId });
      } catch (err) {
        console.error('Failed to disconnect', err);
      }
    }
    set({ activeId: null, activeDb: null, activeSchema: 'public' });
  },
  setActiveDb: (activeDb) => set({ activeDb }),
  setActiveSchema: (activeSchema) => set({ activeSchema }),
}));
