import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { QueryResult, DataOptions } from '../types/query';

export type TabType = 'editor' | 'table' | 'table-properties' | 'function-properties' | 'sequence-properties' | 'server-info';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  schema?: string;
  tableName?: string;
  sql?: string;
  scriptPath?: string;
  queryResult?: QueryResult | null;
  loading?: boolean;
  error?: string | null;
  dataOptions?: DataOptions;
  explainPlan?: any;
}

interface SavedTab {
  id: string;
  tab_type: string;
  title: string;
  sql?: string;
  schema?: string;
  table_name?: string;
  script_path?: string;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  persistTabs: () => Promise<void>;
  restoreTabs: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedPersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = useTabStore.getState();
    state.persistTabs();
  }, 1000);
}

function tabsToSavedTabs(tabs: Tab[]): SavedTab[] {
  return tabs.map((t) => ({
    id: t.id,
    tab_type: t.type,
    title: t.title,
    sql: t.sql,
    schema: t.schema,
    table_name: t.tableName,
    script_path: t.scriptPath,
  }));
}

export const useTabStore = create<TabState>((set) => ({
  tabs: [
    {
      id: 'default-editor',
      type: 'editor',
      title: 'Query 1',
      schema: 'public',
      sql: '',
      queryResult: null,
      loading: false,
      error: null,
    },
  ],
  activeTabId: 'default-editor',

  addTab: (newTab) => {
    const id = `${newTab.type}_${Date.now()}`;
    const tabWithId: Tab = { ...newTab, id };
    set((state) => ({
      tabs: [...state.tabs, tabWithId],
      activeTabId: id,
    }));
    debouncedPersist();
  },

  closeTab: (id) => {
    set((state) => {
      const remainingTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      if (newActiveId === id) {
        newActiveId = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null;
      }
      return {
        tabs: remainingTabs,
        activeTabId: newActiveId,
      };
    });
    debouncedPersist();
  },

  setActiveTabId: (activeTabId) => set({ activeTabId }),

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    if ('sql' in updates || 'title' in updates) {
      debouncedPersist();
    }
  },

  persistTabs: async () => {
    try {
      const { tabs } = useTabStore.getState();
      const saved = tabsToSavedTabs(tabs);
      await invoke('save_tab_state', { tabs: saved });
    } catch (err) {
      console.error('Failed to persist tabs:', err);
    }
  },

  restoreTabs: async () => {
    try {
      const saved = await invoke<SavedTab[]>('load_tab_state');
      if (!saved || saved.length === 0) return;

      const tabs: Tab[] = saved.map((s) => ({
        id: s.id,
        type: s.tab_type as TabType,
        title: s.title,
        sql: s.sql,
        schema: s.schema,
        tableName: s.table_name,
        scriptPath: s.script_path,
        queryResult: null,
        loading: false,
        error: null,
      }));

      set({
        tabs,
        activeTabId: tabs.length > 0 ? tabs[tabs.length - 1].id : null,
      });
    } catch (err) {
      console.error('Failed to restore tabs:', err);
    }
  },
}));
