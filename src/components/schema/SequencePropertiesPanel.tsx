import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTabStore } from '../../stores/tabStore';
import { useToast } from '../common/Toast';
import { Activity, Info, FileCode } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import styles from '../../styles/components/SequencePropertiesPanel.module.css';

interface Props {
  schema: string;
  name: string;
}

type SubTab = 'ddl' | 'properties';

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'properties', label: 'Properties', icon: <Info size={13} /> },
  { key: 'ddl', label: 'DDL', icon: <FileCode size={13} /> },
];

interface SequenceDetails {
  name: string;
  schema: string;
  data_type: string;
  start_value: number;
  increment_by: number;
  max_value: number;
  min_value: number;
  cache_size: number;
  is_cycled: boolean;
  last_value: number | null;
  ddl: string;
}

export const SequencePropertiesPanel: React.FC<Props> = ({ schema, name }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('properties');
  const [details, setDetails] = useState<SequenceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const loadedRef = useRef(false);
  const activeId = useConnectionStore((s) => s.activeId);
  const { settings } = useSettingsStore();
  const { addTab } = useTabStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!activeId || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setError('');

    invoke<SequenceDetails>('get_sequence_details', {
      connId: activeId,
      schema,
      name,
    })
      .then((res) => {
        setDetails(res);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || String(err));
        setLoading(false);
      });
  }, [activeId, schema, name]);

  const copyDdl = () => {
    if (details?.ddl) {
      navigator.clipboard.writeText(details.ddl);
      toast('Copied DDL to clipboard', 'success');
    }
  };

  const openInEditor = () => {
    if (details?.ddl) {
      addTab({
        type: 'editor',
        title: `${name}.sql`,
        sql: details.ddl,
      });
    }
  };

  const renderSubTab = () => {
    if (loading) return <div className={styles.ddlLoading}>Loading sequence details...</div>;
    if (error) return <div className={styles.ddlError}>{error}</div>;
    if (!details) return <div className={styles.ddlLoading}>No sequence details.</div>;

    switch (activeSubTab) {
      case 'ddl':
        return (
          <div className={styles.ddlContainer}>
            <div className={styles.ddlToolbar}>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 10px', fontSize: '0.7rem' }}
                onClick={copyDdl}
              >
                Copy DDL
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '3px 10px', fontSize: '0.7rem' }}
                onClick={openInEditor}
              >
                Open in SQL Editor
              </button>
            </div>
            <div className={styles.ddlEditorWrapper}>
              <MonacoEditor
                height="100%"
                language="sql"
                theme={settings.theme === 'dark' ? 'vs-dark' : 'light'}
                value={details.ddl || '-- No DDL available.'}
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
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                  },
                }}
              />
            </div>
          </div>
        );

      case 'properties':
        return (
          <div style={{ padding: '12px' }}>
            <table className={styles.dataTable}>
              <tbody>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Schema</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.schema}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Sequence Name</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.name}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Data Type</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.data_type}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Last Value</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>
                    {details.last_value !== null ? details.last_value : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Never called</span>}
                  </td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Start Value</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.start_value}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Increment By</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.increment_by}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Min Value</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.min_value}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Max Value</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.max_value}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Cache Size</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.cache_size}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Cycled?</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{details.is_cycled ? 'YES' : 'NO'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <Activity size={16} style={{ color: 'var(--warning)' }} />
          <h3 className={styles.sequenceName}>
            {schema}.{name}
          </h3>
          <span className={`${styles.badge} ${styles.badgeSequence}`}>SEQUENCE</span>
          {details?.data_type && (
            <span className={`${styles.badge} ${styles.badgeDataType}`}>
              {details.data_type.toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.headerMeta}>
          <span>Increment: {details?.increment_by ?? '1'}</span>
          <span>Last value: {details?.last_value !== null && details?.last_value !== undefined ? details.last_value : 'never called'}</span>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className={styles.subTabBar}>
        {SUB_TABS.map((tab) => (
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

      {/* Content */}
      <div className={`${styles.content} ${activeSubTab === 'ddl' ? styles.contentDdl : ''}`}>
        {renderSubTab()}
      </div>
    </div>
  );
};

export default SequencePropertiesPanel;
