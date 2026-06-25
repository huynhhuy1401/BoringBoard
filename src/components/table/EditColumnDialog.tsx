import React, { useState } from 'react';
import { X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useToast } from '../common/Toast';
import { Column } from '../../types/schema';
import styles from '../../styles/components/CreateTableDialog.module.css';

const PG_TYPES = [
  'text', 'integer', 'bigint', 'smallint', 'boolean', 'numeric',
  'varchar', 'char', 'real', 'double precision', 'date', 'time',
  'timestamp', 'timestamptz', 'interval', 'uuid', 'json', 'jsonb',
  'bytea', 'serial', 'bigserial', 'inet', 'cidr', 'macaddr',
];

interface EditColumnDialogProps {
  schema: string;
  tableName: string;
  column: Column;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditColumnDialog: React.FC<EditColumnDialogProps> = ({
  schema,
  tableName,
  column,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeId } = useConnectionStore();
  const { toast } = useToast();
  const [dataType, setDataType] = useState(column.data_type);
  const [nullable, setNullable] = useState(column.is_nullable);
  const [defaultVal, setDefaultVal] = useState(column.column_default || '');
  const [hasDefault, setHasDefault] = useState(!!column.column_default);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const hasChanges =
    dataType !== column.data_type ||
    nullable !== column.is_nullable ||
    hasDefault !== !!column.column_default ||
    (hasDefault && defaultVal !== (column.column_default || ''));

  const handleSave = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      if (dataType !== column.data_type) {
        await invoke('alter_table_alter_column_type', {
          connId: activeId,
          schema,
          table: tableName,
          columnName: column.name,
          newType: dataType,
        });
      }
      if (nullable !== column.is_nullable) {
        await invoke('alter_table_alter_column_nullable', {
          connId: activeId,
          schema,
          table: tableName,
          columnName: column.name,
          nullable,
        });
      }
      if (hasDefault !== !!column.column_default || (hasDefault && defaultVal !== (column.column_default || ''))) {
        await invoke('alter_table_alter_column_default', {
          connId: activeId,
          schema,
          table: tableName,
          columnName: column.name,
          default: hasDefault && defaultVal.trim() ? defaultVal.trim() : null,
        });
      }
      toast(`Column "${column.name}" updated`, 'success');
      const store = useSchemaStore.getState();
      await store.fetchTableDetails(activeId, schema, tableName);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(`Failed to alter column: ${err.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Column: {column.name}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
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
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditColumnDialog;
