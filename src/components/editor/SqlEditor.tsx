import React, { useState, useRef, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore, Tab } from '../../stores/tabStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { Splitter } from '../layout/Splitter';
import { Play, HelpCircle, Loader2, Square, AlignLeft, Database, Save, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { QueryResult } from '../../types/query';
import { DataGrid } from '../grid/DataGrid';
import { PlanVisualizer } from './PlanVisualizer';
import { createSchemaCompletionProvider } from '../../editor/autocomplete';
import { formatSql } from '../../editor/formatter';
import { useToast } from '../common/Toast';
import type { IDisposable } from 'monaco-editor';
import styles from '../../styles/components/SqlEditor.module.css';

interface SqlEditorProps {
  tab: Tab;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ tab }) => {
  const { activeId } = useConnectionStore();
  const { updateTab, addTab } = useTabStore();
  const { settings } = useSettingsStore();
  const { schemas } = useSchemaStore();
  const { toast } = useToast();
  const [editorSql, setEditorSql] = useState(tab.sql || '');
  const [explainViewMode, setExplainViewMode] = useState<'plan' | 'json'>('plan');
  const completionDisposable = useRef<IDisposable | null>(null);
  const scriptPathRef = useRef<string | undefined>(tab.scriptPath);

  const activeSchema = tab.schema || 'public';

  // Keep ref in sync
  useEffect(() => {
    scriptPathRef.current = tab.scriptPath;
  }, [tab.scriptPath]);

  const handleSchemaChange = (newSchema: string) => {
    updateTab(tab.id, { schema: newSchema });
  };

  const handleRunQuery = async () => {
    if (!activeId) return;
    updateTab(tab.id, { loading: true, error: null, queryResult: null, explainPlan: undefined });

    try {
      const result = await invoke<QueryResult>('execute_query', {
        connId: activeId,
        sql: editorSql,
        schema: activeSchema,
      });
      updateTab(tab.id, { queryResult: result, loading: false });
    } catch (err: any) {
      updateTab(tab.id, { error: err.message || err.toString(), loading: false });
    }
  };

  const handleExplainQuery = async () => {
    if (!activeId) return;
    updateTab(tab.id, { loading: true, error: null, queryResult: null, explainPlan: undefined });

    try {
      const result = await invoke<any>('explain_query', {
        connId: activeId,
        sql: editorSql,
        schema: activeSchema,
      });

      const explainPlan = result.plan;
      const explainText = JSON.stringify(result.plan, null, 2);
      const queryResult: QueryResult = {
        columns: [{ name: 'Query Plan (JSON)', data_type: 'jsonb', udt_name: 'jsonb' }],
        rows: [[explainText]],
        affected_rows: 1,
        execution_time_ms: result.execution_time_ms,
      };

      setExplainViewMode('plan');
      updateTab(tab.id, { queryResult, explainPlan, loading: false });
    } catch (err: any) {
      updateTab(tab.id, { error: err.message || err.toString(), loading: false });
    }
  };

  const handleCancelQuery = async () => {
    if (!activeId) return;
    try {
      await invoke('cancel_query', { connId: activeId });
    } catch (err: any) {
      console.error('Failed to cancel query:', err);
    }
  };

  const handleFormat = () => {
    const formatted = formatSql(editorSql);
    setEditorSql(formatted);
    updateTab(tab.id, { sql: formatted });
  };

  const handleEditorChange = (value: string | undefined) => {
    const val = value || '';
    setEditorSql(val);
    updateTab(tab.id, { sql: val });
  };

  const handleManualSave = async () => {
    if (!scriptPathRef.current) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const filePath = await save({
          defaultPath: `~/boringboard-scripts/${tab.title}.sql`,
          filters: [{ name: 'SQL', extensions: ['sql'] }],
        });
        if (filePath) {
          const name = filePath.split('/').pop()?.replace('.sql', '') || tab.title;
          const result = await invoke<{ name: string; path: string }>('save_sql_script', { name, sql: editorSql });
          scriptPathRef.current = result.path;
          updateTab(tab.id, { scriptPath: result.path, title: name });
          toast(`Saved as ${name}.sql`, 'success');
        }
      } catch (err: any) {
        toast('Failed to save script', 'error');
      }
    } else {
      try {
        const name = scriptPathRef.current.split('/').pop()?.replace('.sql', '') || tab.title;
        await invoke('save_sql_script', { name, sql: editorSql });
        toast('Saved', 'success');
      } catch (err: any) {
        toast('Failed to save script', 'error');
      }
    }
  };

  const handleOpenFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        defaultPath: '~/boringboard-scripts/',
        filters: [{ name: 'SQL', extensions: ['sql'] }],
      });
      if (selected && typeof selected === 'string') {
        const script = await invoke<{ name: string; path: string; sql: string }>('load_sql_script', { path: selected });
        addTab({
          type: 'editor',
          title: script.name,
          schema: activeSchema,
          sql: script.sql,
          scriptPath: script.path,
        });
      }
    } catch (err: any) {
      toast('Failed to open file', 'error');
    }
  };

  const setupEditor = (editor: any, monaco: any) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunQuery();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      handleExplainQuery();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      handleFormat();
    });

    if (completionDisposable.current) {
      completionDisposable.current.dispose();
    }
    completionDisposable.current = monaco.languages.registerCompletionItemProvider(
      'sql',
      createSchemaCompletionProvider(),
    );
  };

  useEffect(() => {
    return () => {
      if (completionDisposable.current) {
        completionDisposable.current.dispose();
        completionDisposable.current = null;
      }
    };
  }, []);

  // Listen for manual save event (Cmd+S)
  useEffect(() => {
    const handler = () => handleManualSave();
    window.addEventListener('bb:save-script', handler);
    return () => window.removeEventListener('bb:save-script', handler);
  }, [editorSql, tab.scriptPath]);

  const scriptName = tab.scriptPath
    ? tab.scriptPath.split('/').pop()?.replace('.sql', '') || tab.title
    : tab.title;

  const editorPanel = (
    <div className={styles.editorPanel}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            className={`${styles.runBtn} ${styles.toolbarBtn}`}
            onClick={handleRunQuery}
            disabled={tab.loading || !activeId}
            title="Run Query (⌘⏎)"
          >
            {tab.loading ? (
              <Loader2 size={12} className={styles.spin} />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
            Run
          </button>
          <button
            className={`${styles.explainBtn} ${styles.toolbarBtn}`}
            onClick={handleExplainQuery}
            disabled={tab.loading || !activeId}
            title="Explain Query (⌘⇧⏎)"
          >
            <HelpCircle size={12} />
            Explain
          </button>
          {tab.loading && (
            <button
              className={`${styles.cancelBtn} ${styles.toolbarBtn}`}
              onClick={handleCancelQuery}
              title="Cancel Execution"
            >
              <Square size={12} fill="currentColor" />
              Cancel
            </button>
          )}
          <div className={styles.schemaSelector}>
            <Database size={11} />
            <select
              className={styles.schemaSelect}
              value={activeSchema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              title="Query search_path schema"
            >
              {schemas.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
              {schemas.length === 0 && <option value="public">public</option>}
            </select>
          </div>
          <span className={styles.scriptName} title={tab.scriptPath || scriptName}>
            {scriptName}
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <button
            className={`${styles.utilityBtn} ${styles.toolbarBtn}`}
            onClick={handleOpenFile}
            title="Open .sql File"
          >
            <FolderOpen size={12} />
            Open
          </button>
          <button
            className={`${styles.utilityBtn} ${styles.toolbarBtn}`}
            onClick={handleFormat}
            title="Format SQL (⌘⇧F)"
          >
            <AlignLeft size={12} />
            Format
          </button>
          <button
            className={`${styles.utilityBtn} ${styles.toolbarBtn}`}
            onClick={handleManualSave}
            title="Save Script (⌘S)"
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      <div className={styles.editorWrapper}>
        <MonacoEditor
          height="100%"
          language="sql"
          theme={settings.theme === 'dark' ? 'vs-dark' : 'light'}
          value={editorSql}
          onChange={handleEditorChange}
          onMount={setupEditor}
          options={{
            fontSize: settings.editor_font_size,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
            lineHeight: 21,
            wordWrap: settings.editor_word_wrap ? 'on' : 'off',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );

  const resultPanel = (
    <div className={styles.resultPanel}>
      {tab.loading && (
        <div className={styles.emptyState}>
          <Loader2 size={24} className={styles.spin} />
          <span>Executing query...</span>
        </div>
      )}

      {tab.error && (
        <div className={styles.errorState}>
          <h5>Query Error</h5>
          <pre>{tab.error}</pre>
        </div>
      )}

      {!tab.loading && !tab.error && tab.queryResult && tab.explainPlan && (
        <>
          <div className={styles.explainToggle}>
            <button
              className={`${styles.explainToggleBtn} ${explainViewMode === 'plan' ? styles.explainToggleBtnActive : ''}`}
              onClick={() => setExplainViewMode('plan')}
            >
              Plan View
            </button>
            <button
              className={`${styles.explainToggleBtn} ${explainViewMode === 'json' ? styles.explainToggleBtnActive : ''}`}
              onClick={() => setExplainViewMode('json')}
            >
              JSON
            </button>
          </div>
          {explainViewMode === 'plan' ? (
            <PlanVisualizer rawPlan={tab.explainPlan} />
          ) : (
            <DataGrid queryResult={tab.queryResult} />
          )}
        </>
      )}

      {!tab.loading && !tab.error && tab.queryResult && !tab.explainPlan && (
        <DataGrid queryResult={tab.queryResult} />
      )}

      {!tab.loading && !tab.error && !tab.queryResult && (
        <div className={styles.emptyState}>
          <span>Write a query and click Run to view results.</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Splitter
        direction="vertical"
        initialSize={350}
        minSize={100}
        maxSize={600}
        primaryPanel="first"
        firstPanel={editorPanel}
        secondPanel={resultPanel}
      />
    </div>
  );
};
export default SqlEditor;
