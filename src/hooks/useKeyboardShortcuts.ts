import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useKeyboardShortcuts(onOpenSettings?: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useTabStore.getState();
      const settings = useSettingsStore.getState().settings;

      // Escape: close dialogs, blur inputs, close context menus
      if (e.key === 'Escape') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          (active as HTMLElement).blur();
          return;
        }
        // Close any open context menus or overlays via click outside
        document.dispatchEvent(new MouseEvent('click'));
        return;
      }

      // Cmd+N: New query tab
      if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        const count = state.tabs.filter((t) => t.type === 'editor').length + 1;
        state.addTab({ type: 'editor', title: `Query ${count}`, sql: '' });
      }

      // Cmd+O: Open .sql file
      if (mod && e.key === 'o' && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('bb:open-file'));
      }

      // Cmd+W: Close current tab
      if (mod && e.key === 'w' && !e.shiftKey) {
        e.preventDefault();
        if (state.activeTabId) {
          state.closeTab(state.activeTabId);
        }
      }

      // Cmd+Shift+[: Previous tab
      if (mod && e.key === '{') {
        e.preventDefault();
        const tabs = state.tabs;
        const idx = tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx > 0) state.setActiveTabId(tabs[idx - 1].id);
        else if (tabs.length > 0) state.setActiveTabId(tabs[tabs.length - 1].id);
      }

      // Cmd+Shift+]: Next tab
      if (mod && e.key === '}') {
        e.preventDefault();
        const tabs = state.tabs;
        const idx = tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx < tabs.length - 1) state.setActiveTabId(tabs[idx + 1].id);
        else if (tabs.length > 0) state.setActiveTabId(tabs[0].id);
      }

      // Cmd+1..9: Jump to tab by index
      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < state.tabs.length) {
          state.setActiveTabId(state.tabs[idx].id);
        }
      }

      // Cmd+D: Toggle dark mode
      if (mod && e.key === 'd' && !e.shiftKey) {
        e.preventDefault();
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        useSettingsStore.getState().updateSettings({ theme: newTheme });
      }

      // Cmd+,: Open settings
      if (mod && e.key === ',' && !e.shiftKey) {
        e.preventDefault();
        if (onOpenSettings) onOpenSettings();
      }

      // Cmd+S: Save script + commit pending DataGrid changes
      if (mod && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('bb:save-script'));
        window.dispatchEvent(new CustomEvent('bb:commit-changes'));
      }

      // Cmd+Z: Undo pending changes in DataGrid
      if (mod && e.key === 'z' && !e.shiftKey) {
        // Only handle if not inside Monaco editor (let Monaco handle its own undo)
        const active = document.activeElement;
        const isInMonaco = active?.closest('.monaco-editor');
        if (!isInMonaco) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('bb:undo-changes'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSettings]);
}
