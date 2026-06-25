import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToast } from '../common/Toast';
import styles from '../../styles/components/CreateTableDialog.module.css';

const PG_TYPES = [
  'text', 'integer', 'bigint', 'smallint', 'boolean', 'numeric',
  'varchar', 'char', 'real', 'double precision', 'date', 'time',
  'timestamp', 'timestamptz', 'interval', 'uuid', 'json', 'jsonb',
  'bytea', 'serial', 'bigserial', 'inet', 'cidr', 'macaddr',
];

interface CreateTableDialogProps {
  schema: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ColumnDef {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string;
}

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
  schema,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeId } = useConnectionStore();
  const { toast } = useToast();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: 'id', data_type: 'serial', nullable: false, default: '' },
  ]);
  const [pkColumns, setPkColumns] = useState<number[]>([0]);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const addColumn = () => {
    setColumns([...columns, { name: '', data_type: 'text', nullable: true, default: '' }]);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
    setPkColumns(pkColumns.filter((i) => i !== index).map((i) => i > index ? i - 1 : i));
  };

  const updateColumn = (index: number, field: keyof ColumnDef, value: any) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], [field]: value };
    setColumns(updated);
  };

  const togglePk = (index: number) => {
    if (pkColumns.includes(index)) {
      setPkColumns(pkColumns.filter((i) => i !== index));
    } else {
      setPkColumns([...pkColumns, index]);
    }
  };

  const handleCreate = async () => {
    if (!activeId || !tableName.trim()) return;
    const validColumns = columns.filter((c) => c.name.trim());
    if (validColumns.length === 0) return;

    // Resolve index-based pkColumns to column names
    const pkNames = pkColumns
      .filter((i) => i < columns.length && columns[i].name.trim())
      .map((i) => columns[i].name.trim());

    setCreating(true);
    try {
      await invoke('create_table', {
        connId: activeId,
        schema,
        tableName: tableName.trim(),
        columns: validColumns.map((c) => ({
          name: c.name.trim(),
          data_type: c.data_type,
          nullable: c.nullable,
          default: c.default.trim() || null,
        })),
        primaryKeyColumns: pkNames.length > 0 ? pkNames : null,
      });
      toast(`Table "${schema}"."${tableName}" created`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(`Failed to create table: ${err.message || err}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Table in {schema}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Table Name</label>
            <input
              type="text"
              className={styles.input}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="my_table"
              autoFocus
            />
          </div>

          <div className={styles.columnsSection}>
            <div className={styles.columnsHeader}>
              <span className={styles.columnsTitle}>Columns</span>
              <button className={styles.addBtn} onClick={addColumn}><Plus size={14} /> Add</button>
            </div>

            <div className={styles.columnsList}>
              {columns.map((col, i) => (
                <div key={i} className={styles.columnRow}>
                  <input
                    type="text"
                    className={styles.colNameInput}
                    value={col.name}
                    onChange={(e) => updateColumn(i, 'name', e.target.value)}
                    placeholder="column_name"
                  />
                  <select
                    className={styles.colTypeSelect}
                    value={col.data_type}
                    onChange={(e) => updateColumn(i, 'data_type', e.target.value)}
                  >
                    {PG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className={styles.colNullable}>
                    <input
                      type="checkbox"
                      checked={col.nullable}
                      onChange={(e) => updateColumn(i, 'nullable', e.target.checked)}
                    />
                    NULL
                  </label>
                  <input
                    type="text"
                    className={styles.colDefaultInput}
                    value={col.default}
                    onChange={(e) => updateColumn(i, 'default', e.target.value)}
                    placeholder="default"
                  />
                  <label className={styles.colPk}>
                    <input
                      type="checkbox"
                      checked={pkColumns.includes(i)}
                      onChange={() => togglePk(i)}
                    />
                    PK
                  </label>
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
            disabled={creating || !tableName.trim() || columns.filter(c => c.name.trim()).length === 0}
          >
            {creating ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTableDialog;
