import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../stores/tabStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { FileText, Trash2, Search, RefreshCw, FolderOpen } from 'lucide-react';
import styles from '../../styles/components/FavoritesPanel.module.css';

interface SqlScript {
  name: string;
  path: string;
  sql: string;
  modified_at: string;
}

export const ScriptsPanel: React.FC = () => {
  const [scripts, setScripts] = useState<SqlScript[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addTab, tabs } = useTabStore();
  const activeSchema = useConnectionStore((s) => s.activeSchema);

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const result = await invoke<SqlScript[]>('list_sql_scripts');
      setScripts(result);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleOpenScript = (script: SqlScript) => {
    // Check if already open
    const existing = tabs.find((t) => t.type === 'editor' && t.scriptPath === script.path);
    if (existing) {
      useTabStore.getState().setActiveTabId(existing.id);
      return;
    }
    addTab({
      type: 'editor',
      title: script.name,
      schema: activeSchema,
      sql: script.sql,
      scriptPath: script.path,
    });
  };

  const handleDelete = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await invoke('delete_sql_script', { path });
      setScripts((prev) => prev.filter((s) => s.path !== path));
    } catch (err) {
      console.error('Failed to delete script:', err);
    }
  };

  const handleLoadFile = async () => {
    // File load not available without dialog plugin
    console.log('Load file not yet implemented');
  };

  const filtered = search
    ? scripts.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.sql.toLowerCase().includes(search.toLowerCase()),
      )
    : scripts;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrapper}>
          <Search size={12} className={styles.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scripts..."
            className={styles.searchInput}
          />
        </div>
        <button className={styles.refreshBtn} onClick={fetchScripts} title="Refresh">
          <RefreshCw size={12} />
        </button>
        <button className={styles.refreshBtn} onClick={handleLoadFile} title="Open .sql file">
          <FolderOpen size={12} />
        </button>
      </div>
      <div className={styles.list}>
        {loading && <div className={styles.loadingState}>Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <FileText size={20} className={styles.emptyIcon} />
            <span>No scripts yet</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Create a new query tab to auto-save
            </span>
          </div>
        )}
        {filtered.map((script) => (
          <div
            key={script.path}
            onClick={() => handleOpenScript(script)}
            className={styles.entry}
            title="Click to open in editor"
          >
            <div className={styles.entryHeader}>
              <span className={styles.entryName}>{script.name}</span>
              <button
                onClick={(e) => handleDelete(e, script.path)}
                title="Delete script"
                className={styles.deleteBtn}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className={styles.entrySql}>
              {formatDate(script.modified_at)}
              {script.sql && ` · ${script.sql.substring(0, 80)}${script.sql.length > 80 ? '...' : ''}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScriptsPanel;
