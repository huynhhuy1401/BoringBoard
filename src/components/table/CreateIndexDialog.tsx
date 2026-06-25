import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useToast } from '../common/Toast';
import styles from '../../styles/components/CreateTableDialog.module.css';

interface CreateIndexDialogProps {
  schema: string;
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface IndexColumnDef {
  name: string;
  sort_order: 'ASC' | 'DESC';
  nulls_order: 'DEFAULT' | 'FIRST' | 'LAST';
}

export const CreateIndexDialog: React.FC<CreateIndexDialogProps> = ({
  schema,
  tableName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeId } = useConnectionStore();
  const { toast } = useToast();
  const [indexName, setIndexName] = useState('');
  const [columns, setColumns] = useState<IndexColumnDef[]>([{ name: '', sort_order: 'ASC', nulls_order: 'DEFAULT' }]);
  const [isUnique, setIsUnique] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !activeId) return;
    const key = `${schema}.${tableName}`;
    const cached = useSchemaStore.getState().columns[key];
    if (cached) {
      setAvailableColumns(cached.map((c) => c.name));
    } else {
      invoke<any[]>('get_columns', { connId: activeId, schema, table: tableName })
        .then((cols) => setAvailableColumns(cols.map((c: any) => c.name)))
        .catch(() => {});
    }
  }, [isOpen, activeId, schema, tableName]);

  if (!isOpen) return null;

  const addColumn = () => setColumns([...columns, { name: '', sort_order: 'ASC', nulls_order: 'DEFAULT' }]);
  const removeColumn = (i: number) => setColumns(columns.filter((_, idx) => idx !== i));
  const updateColumn = (i: number, field: keyof IndexColumnDef, value: string) => {
    const updated = [...columns];
    updated[i] = { ...updated[i], [field]: value };
    setColumns(updated);
  };

  const validColumns = columns.filter((c) => c.name.trim());

  const handleCreate = async () => {
    if (!activeId || !indexName.trim() || validColumns.length === 0) return;
    setCreating(true);
    try {
      await invoke('create_index', {
        connId: activeId,
        schema,
        table: tableName,
        indexName: indexName.trim(),
        columns: validColumns.map((c) => ({
          name: c.name.trim(),
          sort_order: c.sort_order,
          nulls_order: c.nulls_order,
        })),
        isUnique,
      });
      toast(`Index "${indexName}" created`, 'success');
      const store = useSchemaStore.getState();
      await store.fetchTableDetails(activeId, schema, tableName);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(`Failed to create index: ${err.message || err}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Index on {tableName}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Index Name</label>
            <input
              type="text"
              className={styles.input}
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              placeholder={`idx_${tableName}_col`}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isUnique}
                onChange={(e) => setIsUnique(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className={styles.label} style={{ margin: 0 }}>UNIQUE index</span>
            </label>
          </div>

          <div className={styles.columnsSection}>
            <div className={styles.columnsHeader}>
              <span className={styles.columnsTitle}>Columns</span>
              <button className={styles.addBtn} onClick={addColumn}><Plus size={14} /> Add</button>
            </div>

            <div className={styles.columnsList}>
              {columns.map((col, i) => (
                <div key={i} className={styles.columnRow} style={{ flexWrap: 'wrap', gap: 6 }}>
                  <select
                    className={styles.input}
                    value={col.name}
                    onChange={(e) => updateColumn(i, 'name', e.target.value)}
                    style={{ flex: '1 1 140px', height: 28 }}
                  >
                    <option value="">-- select column --</option>
                    {availableColumns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    className={styles.input}
                    value={col.sort_order}
                    onChange={(e) => updateColumn(i, 'sort_order', e.target.value)}
                    style={{ width: 72, height: 28 }}
                  >
                    <option value="ASC">ASC</option>
                    <option value="DESC">DESC</option>
                  </select>
                  <select
                    className={styles.input}
                    value={col.nulls_order}
                    onChange={(e) => updateColumn(i, 'nulls_order', e.target.value)}
                    style={{ width: 100, height: 28 }}
                  >
                    <option value="DEFAULT">NULLS</option>
                    <option value="FIRST">NULLS FIRST</option>
                    <option value="LAST">NULLS LAST</option>
                  </select>
                  <button className={styles.removeBtn} onClick={() => removeColumn(i)}><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>Cancel</button>
          <button
            className={`${styles.btn} ${styles.createBtn}`}
            onClick={handleCreate}
            disabled={creating || !indexName.trim() || validColumns.length === 0}
          >
            {creating ? 'Creating...' : 'Create Index'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateIndexDialog;
