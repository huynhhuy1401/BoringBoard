import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../stores/tabStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { FileText, Database, X, Plus } from 'lucide-react';
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
                {tab.type === 'editor' ? <FileText size={13} /> : tab.type === 'server-info' ? <Database size={13} /> : <Database size={13} />}
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
