import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../stores/tabStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Trash2, Search, Star } from 'lucide-react';
import styles from '../../styles/components/FavoritesPanel.module.css';

interface QueryFavorite {
  id: string;
  name: string;
  sql: string;
  created_at: string;
  conn_id: string;
}

export const FavoritesPanel: React.FC = () => {
  const [favorites, setFavorites] = useState<QueryFavorite[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addTab } = useTabStore();

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const result = await invoke<QueryFavorite[]>('list_query_favorites');
      setFavorites(result);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await invoke('delete_query_favorite', { id });
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Failed to delete favorite:', err);
    }
  };

  const handleOpenQuery = (sql: string) => {
    const count = useTabStore.getState().tabs.filter((t) => t.type === 'editor').length + 1;
    const activeSchema = useConnectionStore.getState().activeSchema;
    addTab({ type: 'editor', title: `Query ${count}`, schema: activeSchema, sql });
  };

  const filtered = search
    ? favorites.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.sql.toLowerCase().includes(search.toLowerCase()),
      )
    : favorites;

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrapper}>
          <Search size={12} className={styles.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search favorites..."
            className={styles.searchInput}
          />
        </div>
      </div>
      <div className={styles.list}>
        {loading && <div className={styles.loadingState}>Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <Star size={20} className={styles.emptyIcon} />
            <span>No favorites yet</span>
          </div>
        )}
        {filtered.map((fav) => (
          <div
            key={fav.id}
            onClick={() => handleOpenQuery(fav.sql)}
            className={styles.entry}
            title="Click to open in editor"
          >
            <div className={styles.entryHeader}>
              <span className={styles.entryName}>{fav.name}</span>
              <button
                onClick={(e) => handleDelete(e, fav.id)}
                title="Delete favorite"
                className={styles.deleteBtn}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className={styles.entrySql}>
              {fav.sql.substring(0, 120)}
              {fav.sql.length > 120 ? '...' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoritesPanel;
