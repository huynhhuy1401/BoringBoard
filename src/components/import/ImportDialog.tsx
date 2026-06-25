import React, { useState, useRef } from 'react';
import { Upload, FileText, Table, Code } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useToast } from '../common/Toast';
import styles from '../../styles/components/ImportDialog.module.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportType = 'csv' | 'json' | 'sql';

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeId, activeSchema } = useConnectionStore();
  const { schemas } = useSchemaStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<ImportType>('csv');
  const [filePath, setFilePath] = useState('');
  const [schema, setSchema] = useState(activeSchema || 'public');
  const [tableName, setTableName] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleHtmlFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilePath(file.name);
    }
  };

  const handleImport = async () => {
    if (!activeId || !filePath) return;

    setImporting(true);
    setResult(null);

    try {
      let res: any;
      if (importType === 'sql') {
        res = await invoke('import_sql_file', {
          connId: activeId,
          filePath,
        });
      } else if (importType === 'csv') {
        if (!tableName.trim()) {
          toast('Table name is required for CSV import', 'error');
          setImporting(false);
          return;
        }
        res = await invoke('import_csv_file', {
          connId: activeId,
          schema,
          table: tableName.trim(),
          filePath,
          hasHeader,
        });
      } else {
        if (!tableName.trim()) {
          toast('Table name is required for JSON import', 'error');
          setImporting(false);
          return;
        }
        res = await invoke('import_json_file', {
          connId: activeId,
          schema,
          table: tableName.trim(),
          filePath,
        });
      }

      setResult(res);
      const total = res.inserted || res.succeeded || 0;
      const failed = res.failed || 0;
      if (failed > 0) {
        toast(`Imported ${total} rows, ${failed} failed`, 'info');
      } else {
        toast(`Successfully imported ${total} ${importType === 'sql' ? 'statements' : 'rows'}`, 'success');
      }
      onSuccess();
    } catch (err: any) {
      toast(`Import failed: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFilePath('');
    setTableName('');
    setResult(null);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import Data</h2>
        </div>

        <div className={styles.body}>
          <div className={styles.typeSelector}>
            <button
              className={`${styles.typeBtn} ${importType === 'csv' ? styles.typeBtnActive : ''}`}
              onClick={() => { setImportType('csv'); setFilePath(''); setResult(null); }}
            >
              <Table size={16} /> CSV
            </button>
            <button
              className={`${styles.typeBtn} ${importType === 'json' ? styles.typeBtnActive : ''}`}
              onClick={() => { setImportType('json'); setFilePath(''); setResult(null); }}
            >
              <FileText size={16} /> JSON
            </button>
            <button
              className={`${styles.typeBtn} ${importType === 'sql' ? styles.typeBtnActive : ''}`}
              onClick={() => { setImportType('sql'); setFilePath(''); setResult(null); }}
            >
              <Code size={16} /> SQL
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>File</label>
            <div className={styles.fileRow}>
              <input
                type="text"
                className={styles.input}
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Select a file..."
                readOnly
              />
              <button className={styles.browseBtn} onClick={handleFileSelect}>
                <Upload size={14} /> Browse
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept={importType === 'csv' ? '.csv,.tsv' : importType === 'json' ? '.json,.jsonl' : '.sql'}
              onChange={handleHtmlFileSelect}
            />
          </div>

          {importType !== 'sql' && (
            <>
              <div className={styles.row}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Schema</label>
                  <select
                    className={styles.input}
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                  >
                    {schemas.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                    {schemas.length === 0 && <option value="public">public</option>}
                  </select>
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Table Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="target_table"
                  />
                </div>
              </div>
              {importType === 'csv' && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(e) => setHasHeader(e.target.checked)}
                  />
                  First row is header
                </label>
              )}
            </>
          )}

          {result && (
            <div className={styles.result}>
              <div className={styles.resultRow}>
                <span>Total:</span>
                <span>{result.total_rows || result.total_statements || 0}</span>
              </div>
              <div className={styles.resultRow}>
                <span>{importType === 'sql' ? 'Succeeded:' : 'Inserted:'}</span>
                <span className={styles.resultSuccess}>{result.inserted || result.succeeded || 0}</span>
              </div>
              {result.failed > 0 && (
                <div className={styles.resultRow}>
                  <span>Failed:</span>
                  <span className={styles.resultError}>{result.failed}</span>
                </div>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className={styles.errorList}>
                  {result.errors.slice(0, 5).map((err: string, i: number) => (
                    <div key={i} className={styles.errorItem}>{err}</div>
                  ))}
                  {result.errors.length > 5 && (
                    <div className={styles.errorItem}>...and {result.errors.length - 5} more errors</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={handleClose}>Cancel</button>
          <button
            className={`${styles.btn} ${styles.importBtn}`}
            onClick={handleImport}
            disabled={importing || !filePath || (!['sql'].includes(importType) && !tableName.trim())}
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
