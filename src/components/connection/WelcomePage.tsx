import React, { useState, useEffect, useMemo } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { ConnectionConfig } from '../../types/connection';
import { ConnectionForm } from './ConnectionForm';
import { Modal } from '../common/Modal';
import { Plus, Trash2, Edit2, Database, Link, Search, Loader2 } from 'lucide-react';
import styles from '../../styles/components/WelcomePage.module.css';

export const WelcomePage: React.FC = () => {
  const { connections, fetchConnections, deleteConnection, connect, activeId, disconnect } = useConnectionStore();
  const { clearSchemaCache, fetchSchemas } = useSchemaStore();
  
  // State for search and selections
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // URL Import Modal State
  const [isUrlImportOpen, setIsUrlImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [importUrlConfig, setImportUrlConfig] = useState<ConnectionConfig | null>(null);
  const [parsingUrl, setParsingUrl] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleCreateNew = () => {
    setSelectedId('new');
    setIsFormOpen(true);
  };

  const handleOpenUrlImport = () => {
    setImportUrl('');
    setUrlError(null);
    setImportUrlConfig(null);
    setIsUrlImportOpen(true);
  };

  const handleUrlImportCancel = () => {
    setIsUrlImportOpen(false);
  };

  const handleUrlImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) {
      setUrlError('URL is required');
      return;
    }

    if (!importUrl.startsWith('postgres://') && !importUrl.startsWith('postgresql://')) {
      setUrlError('Invalid connection URL protocol. Must start with postgres:// or postgresql://');
      return;
    }

    setParsingUrl(true);
    setUrlError(null);

    try {
      const parsedConfig = await import('@tauri-apps/api/core').then((mod) =>
        mod.invoke<ConnectionConfig>('parse_connection_url', { url: importUrl })
      );
      
      const fullConfig: ConnectionConfig = {
        ...parsedConfig,
        id: `conn_${Date.now()}`,
        save_password: true,
      };

      setImportUrlConfig(fullConfig);
      setIsUrlImportOpen(false);
      setIsFormOpen(true);
    } catch (err: any) {
      setUrlError(err.message || err.toString() || 'Failed to parse connection URL');
    } finally {
      setParsingUrl(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const confirmDelete = async (id: string) => {
    setDeletingId(null);
    await deleteConnection(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleConnectClick = async (config: ConnectionConfig) => {
    setConnectingId(config.id);
    try {
      if (activeId) {
        await disconnect();
      }
      clearSchemaCache();
      await connect(config);
      await fetchSchemas(config.id);
    } catch (err: any) {
      alert(`Connection failed: ${err.message || err}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedId(null);
    setImportUrlConfig(null);
    fetchConnections();
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setSelectedId(null);
    setImportUrlConfig(null);
  };

  // Filter connections by search query and group
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    connections.forEach((c) => { if (c.group) groupSet.add(c.group); });
    return Array.from(groupSet).sort();
  }, [connections]);

  const filteredConnections = connections.filter((conn) => {
    const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.database.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = !selectedGroup || conn.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const selectedConfig = selectedId && selectedId !== 'new'
    ? connections.find(c => c.id === selectedId) || null
    : null;

  return (
    <div className={styles.launcherWindow}>
      {/* Left Sidebar */}
      <div className={styles.sidebar}>
          {/* Brand Header */}
          <div className={styles.brandSection}>
            <div className={styles.logoWrapper}>
              <div className={styles.logoBox}>
                <div className={styles.logoSymbol}>
                  <Database size={26} className={styles.logoIcon} />
                </div>
              </div>
            </div>
            <h1 className={styles.brandTitle}>PgLens</h1>
            <p className={styles.brandVersion}>PostgreSQL client</p>
          </div>

          {/* Action Pills */}
          <div className={styles.actionButtons}>
            <button className={styles.primaryBtn} onClick={handleCreateNew}>
              <Plus size={14} />
              <span>Create Connection...</span>
            </button>
            <button className={styles.secondaryActionBtn} onClick={handleOpenUrlImport}>
              <Link size={13} />
              <span>Import from URL...</span>
            </button>
          </div>
        </div>

        {/* Right Main Panel */}
        <div className={styles.mainPanel}>
          {/* Top Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <button className={styles.toolbarBtn} onClick={handleCreateNew} title="New connection profile">
                <Plus size={15} />
              </button>
              {groups.length > 0 && (
                <select
                  className={styles.groupFilter}
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  <option value="">All Groups</option>
                  {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
            </div>
            <div className={styles.searchWrapper}>
              <Search size={13} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search connections..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Connection List Rows / Empty State */}
          <div className={styles.contentArea}>
            {connections.length === 0 ? (
              <div className={styles.emptyState}>
                <Database size={56} className={styles.largeDbIcon} />
                <h1>No Connections</h1>
                <p>
                  Create a connection profile or import from a URL to get started.
                </p>
                <button className={styles.trySampleBtn} onClick={handleCreateNew}>
                  Create Profile
                </button>
              </div>
            ) : (
              <div className={styles.connectionList}>
                {filteredConnections.map((conn) => {
                  const isActive = selectedId === conn.id;
                  return (
                    <div
                      key={conn.id}
                      className={`${styles.connRow} ${isActive ? styles.connRowActive : ''}`}
                      onClick={() => handleConnectClick(conn)}
                    >
                      <div className={styles.iconBox}>
                        {connectingId === conn.id ? (
                          <Loader2 size={15} className={styles.spin} />
                        ) : (
                          <Database size={15} />
                        )}
                      </div>
                      <div className={styles.connInfo}>
                        <div className={styles.connNameRow}>
                          <span className={styles.connName}>{conn.name}</span>
                          {conn.color_tag && (
                            <span
                              className={styles.colorTagDot}
                              style={{ backgroundColor: conn.color_tag }}
                              title="Color Tag"
                            />
                          )}
                        </div>
                        <span className={styles.connDetails}>
                          {conn.group && <span className={styles.connGroup}>{conn.group}</span>}
                          {conn.host}:{conn.port} &middot; {conn.database}
                        </span>
                      </div>
                      <div className={styles.connActions}>
                        {deletingId === conn.id ? (
                          <div className={styles.confirmDeleteRow} onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`${styles.confirmBtn} ${styles.yesBtn}`}
                              onClick={() => confirmDelete(conn.id)}
                            >
                              Yes
                            </button>
                            <button
                              className={`${styles.confirmBtn} ${styles.noBtn}`}
                              onClick={() => setDeletingId(null)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className={styles.actionIconBtn}
                              onClick={(e) => handleEditClick(e, conn.id)}
                              title="Edit Connection"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className={`${styles.actionIconBtn} ${styles.actionIconBtnDelete}`}
                              onClick={(e) => handleDeleteClick(e, conn.id)}
                              title="Delete Connection"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* Connection Form Dialog Modal */}
      <Modal isOpen={isFormOpen} onClose={handleFormCancel}>
        <ConnectionForm
          initialConfig={importUrlConfig || selectedConfig}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* URL Import Modal */}
      <Modal isOpen={isUrlImportOpen} onClose={handleUrlImportCancel}>
        <form onSubmit={handleUrlImportSubmit} className={styles.urlImportModal}>
          <h3 className={styles.urlModalTitle}>Import Connection from URL</h3>
          <p className={styles.urlModalDesc}>
            Type or paste a connection URL to automatically parse and configure your profile.
          </p>
          <div className={styles.urlInputContainer}>
            <input
              type="text"
              className={styles.urlModalInput}
              placeholder="postgresql://username:password@localhost:5432/postgres"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              autoFocus
            />
            {urlError && <div className={styles.urlModalError}>{urlError}</div>}
          </div>
          <div className={styles.urlModalActions}>
            <button
              type="button"
              className={`${styles.urlModalBtn} ${styles.urlModalBtnSecondary}`}
              onClick={handleUrlImportCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.urlModalBtn} ${styles.urlModalBtnPrimary}`}
              disabled={parsingUrl}
            >
              {parsingUrl && <Loader2 size={14} className={styles.spin} />}
              Submit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WelcomePage;
