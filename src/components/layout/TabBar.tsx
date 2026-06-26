import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../stores/tabStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { FileText, Database, X, Plus, Table, Settings, Code2, Activity } from 'lucide-react';
import styles from '../../styles/components/TabBar.module.css';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, addTab } = useTabStore();
  const { activeId, activeSchema } = useConnectionStore();

  const handleTabClick = (id: string) => {
    setActiveTabId(id);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  };

  const handleAddTab = async () => {
    if (!activeId) return;
    const count = tabs.filter((t) => t.type === 'editor').length + 1;
    const name = `Query ${count}`;

    // Create script file
    let scriptPath: string | undefined;
    try {
      const result = await invoke<{ name: string; path: string }>('save_sql_script', { name, sql: '' });
      scriptPath = result.path;
    } catch (err) {
      console.error('Failed to create script file:', err);
    }

    addTab({
      type: 'editor',
      title: name,
      schema: activeSchema,
      sql: '',
      scriptPath,
    });
  };

  const getTabIcon = (type: string, isActive: boolean) => {
    const color = isActive ? undefined : 'var(--text-muted)';
    switch (type) {
      case 'editor':
        return <FileText size={13} style={isActive ? { color: 'var(--accent)' } : { color }} />;
      case 'table':
        return <Table size={13} style={isActive ? { color: 'var(--accent)' } : { color }} />;
      case 'table-properties':
        return <Settings size={13} style={isActive ? { color: 'var(--warning)' } : { color }} />;
      case 'function-properties':
        return <Code2 size={13} style={isActive ? { color: 'var(--info)' } : { color }} />;
      case 'sequence-properties':
        return <Activity size={13} style={isActive ? { color: 'var(--warning)' } : { color }} />;
      case 'server-info':
        return <Database size={13} style={isActive ? { color: 'var(--success)' } : { color }} />;
      default:
        return <Database size={13} style={{ color }} />;
    }
  };

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabsList}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className={styles.icon}>
                {getTabIcon(tab.type, isActive)}
              </span>
              <span className={styles.title}>{tab.title}</span>
              <button
                className={styles.closeBtn}
                onClick={(e) => handleClose(e, tab.id)}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
      <button className={styles.addTabBtn} onClick={handleAddTab} title="New Query Tab">
        <Plus size={14} />
      </button>
    </div>
  );
};
export default TabBar;
