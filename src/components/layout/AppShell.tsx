import React, { useEffect, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore } from '../../stores/tabStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { StatusBar } from './StatusBar';
import { Splitter } from './Splitter';
import { SqlEditor } from '../editor/SqlEditor';
import { DataGrid } from '../grid/DataGrid';
import { TablePropertiesPanel } from '../table/TablePropertiesPanel';
import { FunctionPropertiesPanel } from '../schema/FunctionPropertiesPanel';
import { SequencePropertiesPanel } from '../schema/SequencePropertiesPanel';
import { WelcomePage } from '../connection/WelcomePage';
import { Toast } from '../common/Toast';
import { SettingsPanel } from '../settings/SettingsPanel';
import { ServerInfoPanel } from '../admin/ServerInfoPanel';
import { invoke } from '@tauri-apps/api/core';
import { QueryResult } from '../../types/query';
import { Loader2, Terminal, Play } from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import styles from '../../styles/components/AppShell.module.css';

export const AppShell: React.FC = () => {
  const activeId = useConnectionStore((s) => s.activeId);
  const activeSchema = useConnectionStore((s) => s.activeSchema);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Restore settings on mount
  useEffect(() => {
    useSettingsStore.getState().fetchSettings();
  }, []);

  // Save tabs on window close
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('tauri://close-requested', async () => {
          await useTabStore.getState().persistTabs();
        });
      } catch {
        // ignore in browser mode
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  useKeyboardShortcuts(() => setSettingsOpen(true));

  // Listen for open-file event from keyboard shortcut (Cmd+O)
  useEffect(() => {
    const handler = async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          defaultPath: '~/boringboard-scripts/',
          filters: [{ name: 'SQL', extensions: ['sql'] }],
        });
        if (selected && typeof selected === 'string') {
          const script = await invoke<{ name: string; path: string; sql: string }>('load_sql_script', { path: selected });
          const store = useTabStore.getState();
          const existing = store.tabs.find((t) => t.type === 'editor' && t.scriptPath === script.path);
          if (existing) {
            store.setActiveTabId(existing.id);
            return;
          }
          store.addTab({
            type: 'editor',
            title: script.name,
            schema: activeSchema,
            sql: script.sql,
            scriptPath: script.path,
          });
        }
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    };
    window.addEventListener('bb:open-file', handler);
    return () => window.removeEventListener('bb:open-file', handler);
  }, [activeSchema]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Lazy-load table data if required
  useEffect(() => {
    if (!activeId || !activeTabId) return;
    // Use getState to read the current tab without adding it as a dependency
    const tab = useTabStore.getState().tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.type !== 'table' || tab.queryResult || tab.loading) return;

    useTabStore.getState().updateTab(tab.id, { loading: true, error: null });

    (async () => {
      try {
        const result = await invoke<QueryResult>('get_table_data', {
          connId: activeId,
          schema: tab.schema,
          table: tab.tableName,
          opts: tab.dataOptions || { limit: 100, offset: 0 },
        });
        useTabStore.getState().updateTab(tab.id, { queryResult: result, loading: false });
      } catch (err: any) {
        useTabStore.getState().updateTab(tab.id, { error: err.message || err.toString(), loading: false });
      }
    })();
  }, [activeId, activeTabId]);

  const handleRefreshTable = async (opts?: import('../../types/query').DataOptions) => {
    if (!activeId) return;
    const { tabs: currentTabs, activeTabId: currentTabId } = useTabStore.getState();
    const tab = currentTabs.find((t) => t.id === currentTabId);
    if (!tab || tab.type !== 'table') return;

    const effectiveOpts = opts || tab.dataOptions || { limit: 100, offset: 0 };
    useTabStore.getState().updateTab(tab.id, { loading: true, error: null, dataOptions: effectiveOpts });

    try {
      const result = await invoke<QueryResult>('get_table_data', {
        connId: activeId,
        schema: tab.schema,
        table: tab.tableName,
        opts: effectiveOpts,
      });
      useTabStore.getState().updateTab(tab.id, { queryResult: result, loading: false });
    } catch (err: any) {
      useTabStore.getState().updateTab(tab.id, { error: err.message || err.toString(), loading: false });
    }
  };

  const handleDataOptionsChange = (opts: import('../../types/query').DataOptions) => {
    handleRefreshTable(opts);
  };

  const renderActiveTabContent = () => {
    if (!activeTab) {
      const handleNewQuery = async () => {
        const store = useTabStore.getState();
        const count = store.tabs.filter((t) => t.type === 'editor').length + 1;
        const name = `Query ${count}`;
        let scriptPath: string | undefined;
        try {
          const result = await invoke<{ name: string; path: string }>('save_sql_script', { name, sql: '' });
          scriptPath = result.path;
        } catch (err) {
          console.error('Failed to create script file:', err);
        }
        store.addTab({ type: 'editor', title: name, schema: activeSchema, sql: '', scriptPath });
      };

      return (
        <div className={styles.emptyWorkspace}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyIcon}>
              <Terminal size={36} />
            </div>
            <h3 className={styles.emptyTitle}>Ready to Query</h3>
            <p className={styles.emptyDesc}>
              Open a SQL editor or double-click a table in the explorer to begin.
            </p>
            <button className={styles.newQueryBtn} onClick={handleNewQuery}>
              <Play size={14} />
              New Query
            </button>
          </div>
        </div>
      );
    }

    if (activeTab.type === 'table-properties') {
      return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <TablePropertiesPanel schema={activeTab.schema!} tableName={activeTab.tableName!} />
        </div>
      );
    }

    if (activeTab.type === 'function-properties') {
      return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <FunctionPropertiesPanel
            schema={activeTab.schema!}
            name={activeTab.tableName!}
            argumentTypes={activeTab.sql!}
          />
        </div>
      );
    }

    if (activeTab.type === 'sequence-properties') {
      return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <SequencePropertiesPanel
            schema={activeTab.schema!}
            name={activeTab.tableName!}
          />
        </div>
      );
    }

    if (activeTab.type === 'server-info') {
      return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <ServerInfoPanel />
        </div>
      );
    }

    if (activeTab.type === 'editor') {
      return <SqlEditor key={activeTab.id} tab={activeTab} />;
    }

    if (activeTab.type === 'table') {
      if (activeTab.loading && !activeTab.queryResult) {
        return (
          <div className={styles.loadingWorkspace}>
            <Loader2 size={24} className={styles.spin} />
            <span>Loading table data...</span>
          </div>
        );
      }
      if (activeTab.error) {
        return (
          <div className={styles.errorWorkspace}>
            <h5>Error Loading Table</h5>
            <pre>{activeTab.error}</pre>
          </div>
        );
      }
      if (activeTab.queryResult) {
        return (
          <div className={styles.tableWorkspace}>
            <DataGrid
              queryResult={activeTab.queryResult}
              schema={activeTab.schema}
              tableName={activeTab.tableName}
              dataOptions={activeTab.dataOptions}
              onDataOptionsChange={handleDataOptionsChange}
              onRefresh={() => handleRefreshTable(activeTab.dataOptions)}
            />
          </div>
        );
      }
    }

    return null;
  };

  const mainPanel = (
    <div className={styles.workspace}>
      <TabBar />
      <div className={styles.tabContent}>
        {renderActiveTabContent()}
      </div>
    </div>
  );

  if (!activeId) {
    return <WelcomePage />;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.main}>
        <Splitter
          direction="horizontal"
          initialSize={260}
          minSize={180}
          maxSize={400}
          primaryPanel="first"
          firstPanel={<Sidebar />}
          secondPanel={mainPanel}
        />
      </div>
      <StatusBar />
      <Toast />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
export default AppShell;
