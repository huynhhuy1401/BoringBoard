import React, { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useToast } from '../common/Toast';
import styles from '../../styles/components/CreateTableDialog.module.css';

type ConstraintKind = 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';

interface AddConstraintDialogProps {
  schema: string;
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddConstraintDialog: React.FC<AddConstraintDialogProps> = ({
  schema,
  tableName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeId } = useConnectionStore();
  const { toast } = useToast();
  const [kind, setKind] = useState<ConstraintKind>('UNIQUE');
  const [constraintName, setConstraintName] = useState('');
  const [columns, setColumns] = useState<string[]>(['']);
  const [checkExpr, setCheckExpr] = useState('');
  const [fkRefTable, setFkRefTable] = useState('');
  const [fkRefColumns, setFkRefColumns] = useState<string[]>(['']);
  const [fkOnDelete, setFkOnDelete] = useState('NO ACTION');
  const [creating, setCreating] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

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
    const cachedTables = useSchemaStore.getState().tables[schema];
    if (cachedTables) {
      setAvailableTables(cachedTables.map((t) => t.name));
    } else {
      invoke<any[]>('get_tables', { connId: activeId, schema })
        .then((tbls) => setAvailableTables(tbls.map((t: any) => t.name)))
        .catch(() => {});
    }
  }, [isOpen, activeId, schema, tableName]);

  if (!isOpen) return null;

  const addCol = () => setColumns([...columns, '']);
  const removeCol = (i: number) => setColumns(columns.filter((_, idx) => idx !== i));
  const updateCol = (i: number, val: string) => {
    const updated = [...columns];
    updated[i] = val;
    setColumns(updated);
  };

  const addFkCol = () => setFkRefColumns([...fkRefColumns, '']);
  const removeFkCol = (i: number) => setFkRefColumns(fkRefColumns.filter((_, idx) => idx !== i));
  const updateFkCol = (i: number, val: string) => {
    const updated = [...fkRefColumns];
    updated[i] = val;
    setFkRefColumns(updated);
  };

  const handleCreate = async () => {
    if (!activeId || !constraintName.trim()) return;
    setCreating(true);
    try {
      let sql = '';
      const q = (s: string) => {
        if (s.includes('"') || s !== s.toLowerCase() || s.includes(' ')) return `"${s}"`;
        return s;
      };

      if (kind === 'UNIQUE' || kind === 'FOREIGN KEY') {
        const validCols = columns.filter((c) => c.trim());
        if (validCols.length === 0) { setCreating(false); return; }
        const colIdents = validCols.map(q).join(', ');
        if (kind === 'FOREIGN KEY') {
          const validFkCols = fkRefColumns.filter((c) => c.trim());
          if (!fkRefTable || validFkCols.length === 0) { setCreating(false); return; }
          const fkColIdents = validFkCols.map(q).join(', ');
          sql = `ALTER TABLE ${q(schema)}.${q(tableName)} ADD CONSTRAINT ${q(constraintName)} FOREIGN KEY (${colIdents}) REFERENCES ${q(schema)}.${q(fkRefTable)} (${fkColIdents}) ON DELETE ${fkOnDelete}`;
        } else {
          sql = `ALTER TABLE ${q(schema)}.${q(tableName)} ADD CONSTRAINT ${q(constraintName)} UNIQUE (${colIdents})`;
        }
      } else {
        if (!checkExpr.trim()) { setCreating(false); return; }
        sql = `ALTER TABLE ${q(schema)}.${q(tableName)} ADD CONSTRAINT ${q(constraintName)} CHECK (${checkExpr})`;
      }

      await invoke('execute_query', { connId: activeId, sql });
      toast(`Constraint "${constraintName}" added`, 'success');
      const store = useSchemaStore.getState();
      await store.fetchTableDetails(activeId, schema, tableName);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(`Failed to add constraint: ${err.message || err}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const validCols = columns.filter((c) => c.trim());
  const canCreate = constraintName.trim() && (
    (kind === 'CHECK' && checkExpr.trim()) ||
    ((kind === 'UNIQUE' || kind === 'FOREIGN KEY') && validCols.length > 0) &&
    (kind !== 'FOREIGN KEY' || (fkRefTable && fkRefColumns.filter((c) => c.trim()).length > 0))
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add Constraint to {tableName}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Constraint Type</label>
            <select
              className={styles.input}
              value={kind}
              onChange={(e) => setKind(e.target.value as ConstraintKind)}
              style={{ height: 32 }}
            >
              <option value="UNIQUE">UNIQUE</option>
              <option value="CHECK">CHECK</option>
              <option value="FOREIGN KEY">FOREIGN KEY</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Constraint Name</label>
            <input
              type="text"
              className={styles.input}
              value={constraintName}
              onChange={(e) => setConstraintName(e.target.value)}
              placeholder={`${tableName}_${kind.toLowerCase().replace(' ', '_')}_constraint`}
              autoFocus
            />
          </div>

          {kind === 'CHECK' ? (
            <div className={styles.field}>
              <label className={styles.label}>Check Expression</label>
              <input
                type="text"
                className={styles.input}
                value={checkExpr}
                onChange={(e) => setCheckExpr(e.target.value)}
                placeholder="e.g. price > 0"
              />
            </div>
          ) : (
            <>
              <div className={styles.columnsSection}>
                <div className={styles.columnsHeader}>
                  <span className={styles.columnsTitle}>{kind === 'FOREIGN KEY' ? 'Local Columns' : 'Columns'}</span>
                  <button className={styles.addBtn} onClick={addCol}><Plus size={14} /> Add</button>
                </div>
                <div className={styles.columnsList}>
                  {columns.map((col, i) => (
                    <div key={i} className={styles.columnRow}>
                      <select
                        className={styles.input}
                        value={col}
                        onChange={(e) => updateCol(i, e.target.value)}
                        style={{ flex: 1, height: 28 }}
                      >
                        <option value="">-- select column --</option>
                        {availableColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button className={styles.removeBtn} onClick={() => removeCol(i)}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {kind === 'FOREIGN KEY' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Referenced Table</label>
                    <select
                      className={styles.input}
                      value={fkRefTable}
                      onChange={(e) => setFkRefTable(e.target.value)}
                      style={{ height: 32 }}
                    >
                      <option value="">-- select table --</option>
                      {availableTables.filter((t) => t !== tableName).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.columnsSection}>
                    <div className={styles.columnsHeader}>
                      <span className={styles.columnsTitle}>Referenced Columns</span>
                      <button className={styles.addBtn} onClick={addFkCol}><Plus size={14} /> Add</button>
                    </div>
                    <div className={styles.columnsList}>
                      {fkRefColumns.map((col, i) => (
                        <div key={i} className={styles.columnRow}>
                          <input
                            type="text"
                            className={styles.input}
                            value={col}
                            onChange={(e) => updateFkCol(i, e.target.value)}
                            placeholder="referenced_column"
                            style={{ flex: 1 }}
                          />
                          <button className={styles.removeBtn} onClick={() => removeFkCol(i)}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>On Delete</label>
                    <select
                      className={styles.input}
                      value={fkOnDelete}
                      onChange={(e) => setFkOnDelete(e.target.value)}
                      style={{ height: 32 }}
                    >
                      <option value="NO ACTION">NO ACTION</option>
                      <option value="CASCADE">CASCADE</option>
                      <option value="SET NULL">SET NULL</option>
                      <option value="SET DEFAULT">SET DEFAULT</option>
                      <option value="RESTRICT">RESTRICT</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>Cancel</button>
          <button
            className={`${styles.btn} ${styles.createBtn}`}
            onClick={handleCreate}
            disabled={creating || !canCreate}
          >
            {creating ? 'Adding...' : 'Add Constraint'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddConstraintDialog;
