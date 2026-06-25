import React, { useState } from 'react';
import { X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useToast } from '../common/Toast';
import styles from '../../styles/components/CreateTableDialog.module.css';

const PG_TYPES = [
  'text', 'integer', 'bigint', 'smallint', 'boolean', 'numeric',
  'varchar', 'char', 'real', 'double precision', 'date', 'time',
  'timestamp', 'timestamptz', 'interval', 'uuid', 'json', 'jsonb',
  'bytea', 'serial', 'bigserial', 'inet', 'cidr', 'macaddr',
];

interface AddColumnDialogProps {
  schema: string;
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddColumnDialog: React.FC<AddColumnDialogProps> = ({
  schema,
  tableName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeId } = useConnectionStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState('text');
  const [nullable, setNullable] = useState(true);
  const [hasDefault, setHasDefault] = useState(false);
  const [defaultVal, setDefaultVal] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const canCreate = name.trim().length > 0;

  const handleCreate = async () => {
    if (!activeId || !canCreate) return;
    setSaving(true);
    try {
      await invoke('alter_table_add_column', {
        connId: activeId,
        schema,
        table: tableName,
        column: {
          name: name.trim(),
          data_type: dataType,
          nullable,
          default: hasDefault && defaultVal.trim() ? defaultVal.trim() : null,
        },
      });
      toast(`Column "${name.trim()}" added to "${tableName}"`, 'success');
      await useSchemaStore.getState().fetchTableDetails(activeId, schema, tableName);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(`Failed to add column: ${err.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add Column to {tableName}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Column Name</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="column_name"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Data Type</label>
            <select
              className={styles.input}
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              style={{ height: 32 }}
            >
              {PG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Nullable</label>
            <label className={styles.colNullable} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={nullable}
                onChange={(e) => setNullable(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Allow NULL values
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Default Value</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={hasDefault}
                  onChange={(e) => setHasDefault(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Set default
              </label>
              {hasDefault && (
                <input
                  type="text"
                  className={styles.input}
                  value={defaultVal}
                  onChange={(e) => setDefaultVal(e.target.value)}
                  placeholder="e.g. NULL, 0, 'text', now()"
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>Cancel</button>
          <button
            className={`${styles.btn} ${styles.createBtn}`}
            onClick={handleCreate}
            disabled={saving || !canCreate}
          >
            {saving ? 'Adding...' : 'Add Column'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnDialog;
