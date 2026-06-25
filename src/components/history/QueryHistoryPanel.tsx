import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../stores/tabStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Trash2, Search, Clock } from 'lucide-react';
import styles from '../../styles/components/QueryHistoryPanel.module.css';

interface HistoryEntry {
  id: string;
  sql: string;
  executed_at: string;
  execution_time_ms: number;
  conn_id: string;
}

export const QueryHistoryPanel: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addTab } = useTabStore();

  const fetchHistory = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const result = await invoke<HistoryEntry[]>('get_query_history', { search: searchTerm || null });
      setEntries(result);
    } catch (err) {
      console.error('Failed to load query history:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchHistory(search || undefined);
    }
  };

  const handleClear = async () => {
    try {
      await invoke('clear_query_history');
      setEntries([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleOpenQuery = (sql: string) => {
    const count = useTabStore.getState().tabs.filter((t) => t.type === 'editor').length + 1;
    const activeSchema = useConnectionStore.getState().activeSchema;
    addTab({ type: 'editor', title: `Query ${count}`, schema: activeSchema, sql });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrapper}>
          <Search size={12} className={styles.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search history..."
            className={styles.searchInput}
          />
        </div>
        <button onClick={handleClear} title="Clear history" className={styles.clearBtn}>
          <Trash2 size={13} />
        </button>
      </div>
      <div className={styles.list}>
        {loading && <div className={styles.loadingState}>Loading...</div>}
        {!loading && entries.length === 0 && (
          <div className={styles.emptyState}>
            <Clock size={20} className={styles.emptyIcon} />
            <span>No query history</span>
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            onClick={() => handleOpenQuery(entry.sql)}
            className={styles.entry}
            title="Click to open in editor"
          >
            <div className={styles.entrySql}>
              {entry.sql.substring(0, 120)}{entry.sql.length > 120 ? '...' : ''}
            </div>
            <div className={styles.entryMeta}>
              <span>{formatDate(entry.executed_at)}</span>
              <span>{entry.execution_time_ms}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
