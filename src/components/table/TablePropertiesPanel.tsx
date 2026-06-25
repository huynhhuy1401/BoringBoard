import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToast } from '../common/Toast';
import { Columns, Key, Link, Fingerprint, Zap, FileCode, Plus, Pencil, Trash2 } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Column } from '../../types/schema';
import { EditColumnDialog } from './EditColumnDialog';
import { AddColumnDialog } from './AddColumnDialog';
import { CreateIndexDialog } from './CreateIndexDialog';
import { AddConstraintDialog } from './AddConstraintDialog';
import styles from '../../styles/components/TablePropertiesPanel.module.css';

interface Props {
  schema: string;
  tableName: string;
}

type SubTab = 'columns' | 'indexes' | 'constraints' | 'foreign-keys' | 'triggers' | 'ddl';

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'columns', label: 'Columns', icon: <Columns size={13} /> },
  { key: 'indexes', label: 'Indexes', icon: <Key size={13} /> },
  { key: 'constraints', label: 'Constraints', icon: <Fingerprint size={13} /> },
  { key: 'foreign-keys', label: 'Foreign Keys', icon: <Link size={13} /> },
  { key: 'triggers', label: 'Triggers', icon: <Zap size={13} /> },
  { key: 'ddl', label: 'DDL', icon: <FileCode size={13} /> },
];

const EMPTY_ARR: any[] = [];

export const TablePropertiesPanel: React.FC<Props> = ({ schema, tableName }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('columns');
  const [ddl, setDdl] = useState<string>('');
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState<string>('');
  const ddlTriedRef = useRef(false);
  const activeId = useConnectionStore((s) => s.activeId);
  const { settings } = useSettingsStore();
  const { toast } = useToast();

  const [editColumn, setEditColumn] = useState<Column | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showCreateIndex, setShowCreateIndex] = useState(false);
  const [showAddConstraint, setShowAddConstraint] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    const state = useSchemaStore.getState();
    const key = `${schema}.${tableName}`;
    if (!state.columns[key]) {
      state.fetchTableDetails(activeId, schema, tableName);
      state.fetchFunctions(activeId, schema);
      state.fetchSequences(activeId, schema);
    }
    if (!state.tables[schema]?.length) {
      state.fetchTables(activeId, schema);
    }
  }, [activeId, schema, tableName]);

  const key = `${schema}.${tableName}`;
  const columns = useSchemaStore((s) => s.columns[key]) || EMPTY_ARR;
  const indexes = useSchemaStore((s) => s.indexes[key]) || EMPTY_ARR;
  const constraints = useSchemaStore((s) => s.constraints[key]) || EMPTY_ARR;
  const triggers = useSchemaStore((s) => s.triggers[key]) || EMPTY_ARR;
  const tables = useSchemaStore((s) => s.tables[schema]) || EMPTY_ARR;

  const tableMeta = tables.find((t: any) => t.name === tableName);
  const fkConstraints = constraints.filter((c: any) => c.constraint_type === 'FOREIGN KEY');

  useEffect(() => {
    if (activeSubTab !== 'ddl' || !activeId || ddlTriedRef.current) return;
    ddlTriedRef.current = true;
    setDdlLoading(true);
    setDdlError('');
    invoke<string>('get_table_ddl', { connId: activeId, schema, table: tableName })
      .then((d) => { setDdl(d); setDdlLoading(false); })
      .catch((err: any) => { setDdlError(err?.message || String(err)); setDdlLoading(false); });
  }, [activeSubTab, activeId, schema, tableName]);

  const isMaterializedView = !!tableMeta?.is_materialized_view;
  const isView = !!tableMeta?.is_view;

  const visibleSubTabs = SUB_TABS.filter((tab) => {
    if (isView) return tab.key === 'columns' || tab.key === 'ddl';
    if (isMaterializedView) return tab.key === 'columns' || tab.key === 'indexes' || tab.key === 'ddl';
    return true;
  });

  useEffect(() => {
    const validKeys = visibleSubTabs.map((t) => t.key);
    if (!validKeys.includes(activeSubTab)) setActiveSubTab('columns');
  }, [tableMeta, activeSubTab]);

  const refreshDetails = async () => {
    if (!activeId) return;
    await useSchemaStore.getState().fetchTableDetails(activeId, schema, tableName);
  };

  const handleDropColumn = async (colName: string) => {
    if (!activeId) return;
    if (!confirm(`Drop column "${colName}" from "${schema}"."${tableName}"?\n\nThis action cannot be undone.`)) return;
    try {
      await invoke('alter_table_drop_column', { connId: activeId, schema, table: tableName, columnName: colName });
      toast(`Column "${colName}" dropped`, 'success');
      await refreshDetails();
    } catch (err: any) {
      toast(`Failed to drop column: ${err.message || err}`, 'error');
    }
  };

  const handleDropIndex = async (indexName: string) => {
    if (!activeId) return;
    if (!confirm(`Drop index "${schema}"."${indexName}"?`)) return;
    try {
      await invoke('drop_index', { connId: activeId, schema, indexName });
      toast(`Index "${indexName}" dropped`, 'success');
      await refreshDetails();
    } catch (err: any) {
      toast(`Failed to drop index: ${err.message || err}`, 'error');
    }
  };

  const handleDropConstraint = async (constraintName: string) => {
    if (!activeId) return;
    if (!confirm(`Drop constraint "${constraintName}" from "${schema}"."${tableName}"?`)) return;
    try {
      await invoke('drop_constraint', { connId: activeId, schema, table: tableName, constraintName, cascade: false });
      toast(`Constraint "${constraintName}" dropped`, 'success');
      await refreshDetails();
    } catch (err: any) {
      toast(`Failed to drop constraint: ${err.message || err}`, 'error');
    }
  };

  const handleDropTrigger = async (triggerName: string) => {
    if (!activeId) return;
    if (!confirm(`Drop trigger "${triggerName}" from "${schema}"."${tableName}"?`)) return;
    try {
      await invoke('drop_trigger', { connId: activeId, schema, triggerName, table: tableName });
      toast(`Trigger "${triggerName}" dropped`, 'success');
      await refreshDetails();
    } catch (err: any) {
      toast(`Failed to drop trigger: ${err.message || err}`, 'error');
    }
  };

  const copyDdl = () => navigator.clipboard.writeText(ddl);

  const renderSubTab = () => {
    switch (activeSubTab) {
      case 'columns':
        return (
          <>
            <div className={styles.toolbar}>
              <button className={styles.toolbarBtn} onClick={() => setShowAddColumn(true)}>
                <Plus size={12} /> Add Column
              </button>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.tableHeader}>
                  <th className={styles.th}>#</th>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Nullable</th>
                  <th className={styles.th}>Default</th>
                  <th className={styles.th}>Keys</th>
                  <th className={styles.th} style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, i) => (
                  <tr key={col.name} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdMuted} ${styles.tdMono}`}>{i + 1}</td>
                    <td className={`${styles.td} ${styles.tdPrimary} ${styles.tdMono}`}>
                      {col.name}
                      {col.comment && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.7rem' }}>— {col.comment}</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`}>
                      {col.data_type}
                      {col.udt_name !== col.data_type && <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.65rem' }}>({col.udt_name})</span>}
                    </td>
                    <td className={styles.td}>
                      {col.is_nullable
                        ? <span className={styles.tdMuted}>YES</span>
                        : <span style={{ color: 'var(--warning)', fontWeight: 600 }}>NOT NULL</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {col.column_default || (col.is_nullable ? 'NULL' : '')}
                    </td>
                    <td className={styles.td}>
                      {col.is_primary_key && <span className={styles.pkBadge}>PK</span>}
                      {col.is_foreign_key && <span className={styles.fkBadge}>FK</span>}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        <button className={styles.actionBtn} title="Edit column" onClick={() => setEditColumn(col)}>
                          <Pencil size={12} />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Drop column" onClick={() => handleDropColumn(col.name)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );

      case 'indexes':
        return (
          <>
            <div className={styles.toolbar}>
              <button className={styles.toolbarBtn} onClick={() => setShowCreateIndex(true)}>
                <Plus size={12} /> Create Index
              </button>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.tableHeader}>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Definition</th>
                  <th className={styles.th} style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {indexes.map((idx) => (
                  <tr key={idx.name} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdPrimary} ${styles.tdMono}`}>{idx.name}</td>
                    <td className={styles.td}>
                      {idx.is_primary && <span className={styles.pkBadge}>PRIMARY</span>}
                      {idx.is_unique && <span className={styles.fkBadge} style={{ background: 'var(--accent)' }}>UNIQUE</span>}
                      {!idx.is_primary && !idx.is_unique && <span className={styles.tdMuted}>INDEX</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`} style={{ fontSize: '0.7rem', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }} title={idx.definition}>
                      {idx.definition}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        {!idx.is_primary && (
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Drop index" onClick={() => handleDropIndex(idx.name)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {indexes.length === 0 && (
                  <tr><td colSpan={4} className={styles.emptyRow}>No indexes</td></tr>
                )}
              </tbody>
            </table>
          </>
        );

      case 'constraints':
        return (
          <>
            <div className={styles.toolbar}>
              <button className={styles.toolbarBtn} onClick={() => setShowAddConstraint(true)}>
                <Plus size={12} /> Add Constraint
              </button>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr className={styles.tableHeader}>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Definition</th>
                  <th className={styles.th} style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {constraints.map((c) => {
                  const badgeColor = c.constraint_type === 'PRIMARY KEY' ? 'var(--warning)'
                    : c.constraint_type === 'FOREIGN KEY' ? 'var(--info)'
                    : c.constraint_type === 'UNIQUE' ? 'var(--accent)'
                    : 'var(--text-muted)';
                  return (
                    <tr key={c.name} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdPrimary} ${styles.tdMono}`}>{c.name}</td>
                      <td className={styles.td}>
                        <span className={styles.constraintBadge} style={{ background: badgeColor }}>{c.constraint_type}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`} style={{ fontSize: '0.7rem' }}>{c.definition}</td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          {c.constraint_type !== 'PRIMARY KEY' && (
                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Drop constraint" onClick={() => handleDropConstraint(c.name)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {constraints.length === 0 && (
                  <tr><td colSpan={4} className={styles.emptyRow}>No constraints</td></tr>
                )}
              </tbody>
            </table>
          </>
        );

      case 'foreign-keys':
        return (
          <table className={styles.dataTable}>
            <thead>
              <tr className={styles.tableHeader}>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Definition</th>
                <th className={styles.th} style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {fkConstraints.map((c) => (
                <tr key={c.name} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tdPrimary} ${styles.tdMono}`}>{c.name}</td>
                  <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`} style={{ fontSize: '0.7rem' }}>{c.definition}</td>
                  <td className={styles.td}>
                    <div className={styles.rowActions}>
                      <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Drop foreign key" onClick={() => handleDropConstraint(c.name)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {fkConstraints.length === 0 && (
                <tr><td colSpan={3} className={styles.emptyRow}>No foreign keys</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'triggers':
        return (
          <table className={styles.dataTable}>
            <thead>
              <tr className={styles.tableHeader}>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Definition</th>
                <th className={styles.th} style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.name} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tdPrimary} ${styles.tdMono}`}>{t.name}</td>
                  <td className={`${styles.td} ${styles.tdSecondary} ${styles.tdMono}`} style={{ fontSize: '0.7rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.definition}>{t.definition}</td>
                  <td className={styles.td}>
                    <div className={styles.rowActions}>
                      <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Drop trigger" onClick={() => handleDropTrigger(t.name)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {triggers.length === 0 && (
                <tr><td colSpan={3} className={styles.emptyRow}>No triggers</td></tr>
              )}
            </tbody>
          </table>
        );

      case 'ddl':
        if (ddlLoading) return <div className={styles.ddlLoading}>Loading DDL...</div>;
        if (ddlError) return <div className={styles.ddlError}>{ddlError}</div>;
        return (
          <div className={styles.ddlContainer}>
            <div className={styles.ddlToolbar}>
              <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.7rem' }} onClick={copyDdl}>Copy DDL</button>
            </div>
            <div className={styles.ddlEditorWrapper}>
              <MonacoEditor
                height="100%"
                language="sql"
                theme={settings.theme === 'dark' ? 'vs-dark' : 'light'}
                value={ddl || '-- No DDL available.'}
                options={{
                  readOnly: true,
                  fontSize: settings.editor_font_size || 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
                  lineHeight: 20,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  folding: true,
                  wordWrap: 'on',
                  renderLineHighlight: 'none',
                  scrollbar: { vertical: 'auto', horizontal: 'auto' },
                }}
              />
            </div>
          </div>
        );
    }
  };

  const rowsEstimate = tableMeta?.row_count_estimate;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h3 className={styles.tableName}>{schema}.{tableName}</h3>
          {isView && <span className={`${styles.badge} ${styles.badgeView}`}>VIEW</span>}
          {isMaterializedView && <span className={`${styles.badge} ${styles.badgeMatView}`}>MATERIALIZED</span>}
        </div>
        <div className={styles.headerMeta}>
          {columns.length > 0 && <span>{columns.length} columns</span>}
          {rowsEstimate != null && !isView && !isMaterializedView && <span>~{rowsEstimate.toLocaleString()} rows</span>}
          {indexes.length > 0 && <span>{indexes.length} indexes</span>}
          {tableMeta?.comment && <span className={styles.metaComment}>{tableMeta.comment}</span>}
        </div>
      </div>

      <div className={styles.subTabBar}>
        {visibleSubTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`${styles.subTab} ${activeSubTab === tab.key ? styles.subTabActive : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`${styles.content} ${activeSubTab === 'ddl' ? styles.contentDdl : ''}`}>
        {renderSubTab()}
      </div>

      {editColumn && (
        <EditColumnDialog
          schema={schema}
          tableName={tableName}
          column={editColumn}
          isOpen={true}
          onClose={() => setEditColumn(null)}
          onSuccess={refreshDetails}
        />
      )}

      {showAddColumn && (
        <AddColumnDialog
          schema={schema}
          tableName={tableName}
          isOpen={true}
          onClose={() => setShowAddColumn(false)}
          onSuccess={refreshDetails}
        />
      )}

      {showCreateIndex && (
        <CreateIndexDialog
          schema={schema}
          tableName={tableName}
          isOpen={true}
          onClose={() => setShowCreateIndex(false)}
          onSuccess={refreshDetails}
        />
      )}

      {showAddConstraint && (
        <AddConstraintDialog
          schema={schema}
          tableName={tableName}
          isOpen={true}
          onClose={() => setShowAddConstraint(false)}
          onSuccess={refreshDetails}
        />
      )}
    </div>
  );
};
