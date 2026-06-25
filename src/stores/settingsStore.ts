import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface AppSettings {
  theme: string;
  editor_font_size: number;
  editor_word_wrap: boolean;
  auto_refresh_monitoring: boolean;
  monitoring_interval_seconds: number;
}

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    theme: 'light',
    editor_font_size: 14,
    editor_word_wrap: false,
    auto_refresh_monitoring: true,
    monitoring_interval_seconds: 10,
  },
  loading: false,
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, loading: false });
      document.body.className = settings.theme;
    } catch (err) {
      console.error('Failed to load settings', err);
      set({ loading: false });
    }
  },
  updateSettings: async (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    try {
      await invoke('save_settings', { settings: updated });
      document.body.className = updated.theme;
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  },
}));
