import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTabStore } from '../../stores/tabStore';
import { useToast } from '../common/Toast';
import { Code2, Info, FileCode } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import styles from '../../styles/components/FunctionPropertiesPanel.module.css';

interface Props {
  schema: string;
  name: string;
  argumentTypes: string;
}

type SubTab = 'definition' | 'properties';

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'definition', label: 'Definition', icon: <FileCode size={13} /> },
  { key: 'properties', label: 'Properties', icon: <Info size={13} /> },
];

export const FunctionPropertiesPanel: React.FC<Props> = ({ schema, name, argumentTypes }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('definition');
  const [ddl, setDdl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const ddlLoadedRef = useRef(false);
  const activeId = useConnectionStore((s) => s.activeId);
  const { settings } = useSettingsStore();
  const { addTab } = useTabStore();
  const { toast } = useToast();

  const [funcMeta, setFuncMeta] = useState<{
    returnType: string;
    language: string;
  } | null>(null);

  // Fetch function details
  useEffect(() => {
    if (!activeId || ddlLoadedRef.current) return;
    ddlLoadedRef.current = true;
    setLoading(true);
    setError('');

    // Fetch DDL definition
    invoke<string>('get_function_ddl', {
      connId: activeId,
      schema,
      name,
      argumentTypes,
    })
      .then((def) => {
        setDdl(def);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || String(err));
        setLoading(false);
      });

    // Also fetch basic metadata from the state
    const stateFuncs = useSchemaStore.getState().functions[schema] || [];
    const matched = stateFuncs.find(
      (f) => f.name === name && f.argument_types === argumentTypes
    );
    if (matched) {
      setFuncMeta({
        returnType: matched.return_type,
        language: matched.language,
      });
    }
  }, [activeId, schema, name, argumentTypes]);

  const copyDdl = () => {
    navigator.clipboard.writeText(ddl);
    toast('Copied DDL to clipboard', 'success');
  };

  const openInEditor = () => {
    addTab({
      type: 'editor',
      title: `${name}.sql`,
      sql: ddl,
    });
  };

  const renderSubTab = () => {
    switch (activeSubTab) {
      case 'definition':
        if (loading) return <div className={styles.ddlLoading}>Loading function definition...</div>;
        if (error) return <div className={styles.ddlError}>{error}</div>;
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
                value={ddl || '-- No definition available.'}
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
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{schema}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Function Name</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{name}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Language</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{funcMeta?.language || 'Unknown'}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Return Type</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{funcMeta?.returnType || 'Unknown'}</td>
                </tr>
                <tr className={styles.tr}>
                  <td className={styles.tdLabel}>Argument Types</td>
                  <td className={`${styles.td} ${styles.tdValue} ${styles.tdMono}`}>{argumentTypes || 'None (void)'}</td>
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
          <Code2 size={16} style={{ color: 'var(--accent)' }} />
          <h3 className={styles.functionName}>
            {schema}.{name}
          </h3>
          <span className={`${styles.badge} ${styles.badgeFunction}`}>FUNCTION</span>
          {funcMeta?.language && (
            <span className={`${styles.badge} ${styles.badgeLanguage}`}>
              {funcMeta.language.toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.headerMeta}>
          <span>Returns: {funcMeta?.returnType || 'void'}</span>
          <span>Arguments: ({argumentTypes || 'void'})</span>
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
      <div className={`${styles.content} ${activeSubTab === 'definition' ? styles.contentDdl : ''}`}>
        {renderSubTab()}
      </div>
    </div>
  );
};

// Import hook to query state
import { useSchemaStore } from '../../stores/schemaStore';
export default FunctionPropertiesPanel;
