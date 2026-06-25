import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useTabStore } from '../../stores/tabStore';
import { useToast } from '../common/Toast';
import { CreateTableDialog } from '../table/CreateTableDialog';
import { AddColumnDialog } from '../table/AddColumnDialog';
import { ImportDialog } from '../import/ImportDialog';
import {
  Database,
  ChevronDown,
  ChevronRight,
  Folder,
  Eye,
  Code2,
  Activity,
  Package,
  Columns,
  Plus,
  RefreshCw,
  Upload,
  Search,
  X
} from 'lucide-react';
import styles from '../../styles/components/SchemaTree.module.css';
import { Table } from '../../types/schema';

export const SchemaTree: React.FC = () => {
  const { activeId, activeDb, activeSchema, connections } = useConnectionStore();
  const {
    databases,
    schemas,
    tables,
    columns,
    functions,
    sequences,
    extensions,
    error,
    fetchDatabases,
    fetchSchemas,
    fetchTables,
    fetchTableDetails,
    fetchFunctions,
    fetchSequences,
    fetchExtensions,
    clearSchemaCache
  } = useSchemaStore();

  const { addTab } = useTabStore();
  const { toast } = useToast();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [createTableSchema, setCreateTableSchema] = useState<string | null>(null);
  const [addColumnTarget, setAddColumnTarget] = useState<{ schema: string; table: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    type: 'schema' | 'table' | 'column' | 'view' | 'function' | 'sequence';
    schema: string;
    tableName?: string;
    columnName?: string;
    functionName?: string;
    argumentTypes?: string;
  } | null>(null);

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on any click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Context menu actions
  const handleViewProperties = (schemaName: string, tableName: string) => {
    addTab({
      type: 'table-properties',
      title: `${tableName} Properties`,
      schema: schemaName,
      tableName,
    });
  };

  const handleViewFunctionProperties = (schemaName: string, funcName: string, argTypes: string) => {
    addTab({
      type: 'function-properties',
      title: `${funcName} Properties`,
      schema: schemaName,
      tableName: funcName,
      sql: argTypes,
    });
  };

  const handleViewSequenceProperties = (schemaName: string, seqName: string) => {
    addTab({
      type: 'sequence-properties',
      title: `${seqName} Properties`,
      schema: schemaName,
      tableName: seqName,
    });
  };

  const handleGenerateSelect = async (schemaName: string, tableName: string) => {
    try {
      const key = `${schemaName}.${tableName}`;
      let cols = useSchemaStore.getState().columns[key];
      if (!cols && activeId) {
        await fetchTableDetails(activeId, schemaName, tableName);
        cols = useSchemaStore.getState().columns[key] || [];
      }
      const colNames = cols.map((c) => c.name);
      const sql = await invoke<string>('generate_select_sql', { schema: schemaName, table: tableName, columns: colNames });
      addTab({ type: 'editor', title: `SELECT ${tableName}`, sql });
    } catch (err: any) {
      console.error('Failed to generate SELECT SQL template:', err);
      addTab({ type: 'editor', title: `SELECT ${tableName}`, sql: `SELECT * FROM "${schemaName}"."${tableName}" LIMIT 100;` });
    }
  };

  const handleGenerateInsert = async (schemaName: string, tableName: string) => {
    try {
      const key = `${schemaName}.${tableName}`;
      let cols = useSchemaStore.getState().columns[key];
      if (!cols && activeId) {
        await fetchTableDetails(activeId, schemaName, tableName);
        cols = useSchemaStore.getState().columns[key] || [];
      }
      const colNames = cols.map((c) => c.name);
      const sql = await invoke<string>('generate_insert_sql', { schema: schemaName, table: tableName, columns: colNames });
      addTab({ type: 'editor', title: `INSERT ${tableName}`, sql });
    } catch (err: any) {
      console.error('Failed to generate INSERT SQL template:', err);
      addTab({ type: 'editor', title: `INSERT ${tableName}`, sql: `INSERT INTO "${schemaName}"."${tableName}" (...) VALUES (...);` });
    }
  };

  const handleCopyTableName = (schemaName: string, tableName: string) => {
    navigator.clipboard.writeText(`"${schemaName}"."${tableName}"`);
  };

  const handleCopyColumnName = (_schema: string, _table: string, colName: string) => {
    navigator.clipboard.writeText(colName);
  };

  const handleCopyColumnFull = (schemaName: string, tableName: string, colName: string) => {
    navigator.clipboard.writeText(`"${schemaName}"."${tableName}"."${colName}"`);
  };

  const handleTruncateTable = async (schemaName: string, tableName: string) => {
    if (!activeId) return;
    if (!confirm(`Truncate table "${schemaName}"."${tableName}"? This will delete ALL rows.`)) return;
    try {
      await invoke('truncate_table', { connId: activeId, schema: schemaName, table: tableName });
      toast(`Truncated table "${schemaName}"."${tableName}"`, 'success');
      await handleRefresh();
    } catch (err: any) {
      alert(`Failed to truncate: ${err.message || err}`);
    }
  };

  const handleDropTable = async (schemaName: string, tableName: string) => {
    if (!activeId) return;
    const cascade = confirm(`Drop table "${schemaName}"."${tableName}"?\n\nPress OK for DROP TABLE.\nPress Cancel for DROP TABLE CASCADE.`);
    try {
      await invoke('drop_table', { connId: activeId, schema: schemaName, table: tableName, cascade });
      await handleRefresh();
    } catch (err: any) {
      alert(`Failed to drop table: ${err.message || err}`);
    }
  };

  const handleRenameTable = async (schemaName: string, tableName: string) => {
    if (!activeId) return;
    const newName = prompt(`Rename table "${schemaName}"."${tableName}" to:`, tableName);
    if (!newName || newName === tableName) return;
    try {
      await invoke('rename_table', { connId: activeId, schema: schemaName, oldName: tableName, newName });
      toast(`Table renamed to "${newName}"`, 'success');
      await handleRefresh();
    } catch (err: any) {
      toast(`Failed to rename table: ${err.message || err}`, 'error');
    }
  };

  const handleVacuumTable = async (schemaName: string, tableName: string) => {
    if (!activeId) return;
    try {
      await invoke('vacuum_table', { connId: activeId, schema: schemaName, table: tableName });
      toast(`Vacuumed "${schemaName}"."${tableName}"`, 'success');
    } catch (err: any) {
      toast(`Failed to vacuum: ${err.message || err}`, 'error');
    }
  };

  const handleAnalyzeTable = async (schemaName: string, tableName: string) => {
    if (!activeId) return;
    try {
      await invoke('analyze_table', { connId: activeId, schema: schemaName, table: tableName });
      toast(`Analyzed "${schemaName}"."${tableName}"`, 'success');
    } catch (err: any) {
      toast(`Failed to analyze: ${err.message || err}`, 'error');
    }
  };

  const handleRenameColumn = async (schemaName: string, tableName: string, columnName: string) => {
    if (!activeId) return;
    const newName = prompt(`Rename column "${columnName}" to:`, columnName);
    if (!newName || newName === columnName) return;
    try {
      await invoke('alter_table_rename_column', { connId: activeId, schema: schemaName, table: tableName, oldName: columnName, newName });
      toast(`Column renamed to "${newName}"`, 'success');
      await fetchTableDetails(activeId, schemaName, tableName);
    } catch (err: any) {
      toast(`Failed to rename column: ${err.message || err}`, 'error');
    }
  };

  const handleFunctionClick = async (schemaName: string, funcName: string, argTypes: string) => {
    try {
      const sql = await invoke<string>('get_function_ddl', {
        connId: activeId!,
        schema: schemaName,
        name: funcName,
        argumentTypes: argTypes
      });
      addTab({
        type: 'editor',
        title: `${funcName}.sql`,
        sql
      });
    } catch (err: any) {
      toast(`Failed to load function definition: ${err.message || err}`, 'error');
    }
  };

  const handleDropView = async (schemaName: string, viewName: string, isMaterialized: boolean) => {
    if (!activeId) return;
    const viewType = isMaterialized ? 'materialized view' : 'view';
    const cascade = confirm(`Drop ${viewType} "${schemaName}"."${viewName}"?\n\nPress OK for DROP ${viewType.toUpperCase()}.\nPress Cancel for DROP ${viewType.toUpperCase()} CASCADE.`);
    try {
      await invoke('drop_view', { connId: activeId, schema: schemaName, view: viewName, isMaterialized, cascade });
      toast(`Dropped ${viewType} "${viewName}"`, 'success');
      await handleRefresh();
    } catch (err: any) {
      alert(`Failed to drop view: ${err.message || err}`);
    }
  };

  const handleDropFunction = async (schemaName: string, funcName: string, argTypes: string) => {
    if (!activeId) return;
    if (!confirm(`Drop function "${schemaName}"."${funcName}(${argTypes})"?`)) return;
    try {
      await invoke('drop_function', { connId: activeId, schema: schemaName, name: funcName, argumentTypes: argTypes, cascade: false });
      toast(`Dropped function "${funcName}"`, 'success');
      await handleRefresh();
    } catch (err: any) {
      alert(`Failed to drop function: ${err.message || err}`);
    }
  };

  const handleDropSequence = async (schemaName: string, seqName: string) => {
    if (!activeId) return;
    const cascade = confirm(`Drop sequence "${schemaName}"."${seqName}"?\n\nPress OK for DROP SEQUENCE.\nPress Cancel for DROP SEQUENCE CASCADE.`);
    try {
      await invoke('drop_sequence', { connId: activeId, schema: schemaName, name: seqName, cascade });
      toast(`Dropped sequence "${seqName}"`, 'success');
      await handleRefresh();
    } catch (err: any) {
      alert(`Failed to drop sequence: ${err.message || err}`);
    }
  };

  useEffect(() => {
    if (activeId) {
      fetchDatabases(activeId);
      fetchSchemas(activeId);
      fetchExtensions(activeId);
    }
  }, [activeId]);

  const handleRefresh = async () => {
    if (!activeId) return;
    setLoading(true);
    clearSchemaCache();
    await Promise.all([
      fetchDatabases(activeId),
      fetchSchemas(activeId),
      fetchExtensions(activeId),
    ]);
    setLoading(false);
  };

  const toggleNode = async (nodePath: string, type: 'schema' | 'table' | 'views-group' | 'tables-group' | 'funcs-group' | 'seqs-group' | 'exts-group', extraData?: any) => {
    const isExpanded = !expandedNodes[nodePath];
    setExpandedNodes((prev) => ({ ...prev, [nodePath]: isExpanded }));

    if (isExpanded && activeId) {
      if (type === 'schema') {
        const schemaName = extraData;
        await Promise.all([
          fetchTables(activeId, schemaName),
          fetchFunctions(activeId, schemaName),
          fetchSequences(activeId, schemaName),
        ]);
      } else if (type === 'table') {
        const { schema, name } = extraData;
        await fetchTableDetails(activeId, schema, name);
      }
    }
  };

  const handleDbChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDb = e.target.value;
    if (!activeId || newDb === activeDb) return;
    
    setLoading(true);
    try {
      const currentConfig = connections.find((c) => c.id === activeId);
      if (currentConfig) {
        await useConnectionStore.getState().disconnect();
        const updatedConfig = { ...currentConfig, database: newDb };
        await useConnectionStore.getState().connect(updatedConfig);
        clearSchemaCache();
        const newActiveId = useConnectionStore.getState().activeId;
        if (newActiveId) {
          await Promise.all([
            fetchDatabases(newActiveId),
            fetchSchemas(newActiveId),
            fetchExtensions(newActiveId),
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to change database', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (table: Table) => {
    // Add grid tab for the table
    addTab({
      type: 'table',
      title: `${table.schema}.${table.name}`,
      schema: table.schema,
      tableName: table.name,
      dataOptions: {
        limit: 100,
        offset: 0,
      },
    });
  };


  if (!activeId) return null;

  return (
    <div className={styles.container}>
      <div className={styles.dbSelector}>
        <Database size={14} className={styles.dbIcon} />
        <select value={activeDb || ''} onChange={handleDbChange} disabled={loading}>
          {databases.map((db) => (
            <option key={db.name} value={db.name}>
              {db.name}
            </option>
          ))}
        </select>
        <button className={styles.refreshBtn} onClick={handleRefresh} disabled={loading} title="Refresh Schema">
          <RefreshCw size={12} className={loading ? styles.spin : ''} />
        </button>
      </div>
      <div className={styles.searchBar}>
        <div className={styles.searchWrapper}>
          <Search size={12} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Filter tables..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className={styles.searchInput}
          />
          {tableSearch && (
            <button className={styles.searchClear} onClick={() => setTableSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
        <button
          className={styles.actionBtn}
          onClick={() => setCreateTableSchema(activeSchema || 'public')}
          title="Create Table"
        >
          <Plus size={13} />
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => setImportOpen(true)}
          title="Import Data"
        >
          <Upload size={13} />
        </button>
      </div>

      <div className={styles.tree}>
        {error ? (
          <div className={styles.errorContainer}>
            <div className={styles.errorHeader}>Failed to Load Schema</div>
            <div className={styles.errorText}>{error}</div>
            <button className="btn btn-secondary" onClick={handleRefresh} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <RefreshCw size={12} style={{ marginRight: 4 }} />
              Retry
            </button>
          </div>
        ) : schemas.map((schema) => {
          const schemaPath = `schema_${schema.name}`;
          const isSchemaExpanded = expandedNodes[schemaPath];
          const schemaTables = tables[schema.name] || [];
          const searchLower = tableSearch.toLowerCase();
          const filteredTables = searchLower
            ? schemaTables.filter((t) => t.name.toLowerCase().includes(searchLower))
            : schemaTables;
          const ordinaryTables = filteredTables.filter((t) => !t.is_view && !t.is_materialized_view);
          const views = filteredTables.filter((t) => t.is_view || t.is_materialized_view);
          const schemaFuncs = functions[schema.name] || [];
          const schemaSeqs = sequences[schema.name] || [];

          return (
            <div key={schema.name} className={styles.node}>
              <div
                className={styles.nodeHeader}
                onClick={() => toggleNode(schemaPath, 'schema', schema.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'schema', schema: schema.name });
                }}
              >
                {isSchemaExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className={styles.schemaIcon} />
                <span>{schema.name}</span>
              </div>

              {isSchemaExpanded && (
                <div className={styles.nodeChildren}>
                  {/* TABLES GROUP */}
                  <div className={styles.subGroup}>
                    <div
                      className={styles.nodeHeader}
                      onClick={() => toggleNode(`${schemaPath}_tables`, 'tables-group')}
                    >
                      {expandedNodes[`${schemaPath}_tables`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.groupLabel}>Tables ({ordinaryTables.length})</span>
                    </div>

                    {expandedNodes[`${schemaPath}_tables`] && (
                      <div className={styles.nodeChildren}>
                        {ordinaryTables.map((table) => {
                          const tablePath = `${schemaPath}_table_${table.name}`;
                          const isTableExpanded = expandedNodes[tablePath];
                          const detailKey = `${schema.name}.${table.name}`;
                          const tableCols = columns[detailKey] || [];

                          return (
                            <div key={table.name} className={styles.tableNode}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({ x: e.clientX, y: e.clientY, type: 'table', schema: schema.name, tableName: table.name });
                              }}>
                              <div
                                className={styles.nodeHeader}
                                onClick={() => toggleNode(tablePath, 'table', { schema: schema.name, name: table.name })}
                              >
                                {isTableExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <Database size={13} className={styles.tableIcon} />
                                <span onClick={(e) => {
                                  e.stopPropagation();
                                  handleTableClick(table);
                                }} className={styles.clickableTitle} title="Click to view data">
                                  {table.name}
                                </span>
                                {table.row_count_estimate != null && table.row_count_estimate >= 0 && (
                                  <span className={styles.rowCount} title="Estimated row count">~{table.row_count_estimate.toLocaleString()}</span>
                                )}
                              </div>

                              {isTableExpanded && (
                                <div className={styles.nodeChildren}>
                                  <div className={styles.attributeGroup}>
                                    {tableCols.map((col) => (
                                      <div key={col.name} className={styles.leafNode}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setContextMenu({ x: e.clientX, y: e.clientY, type: 'column', schema: schema.name, tableName: table.name, columnName: col.name });
                                        }}
                                      >
                                        <Columns size={11} className={styles.leafIcon} />
                                        <span className={col.is_primary_key ? styles.primaryKey : ''}>
                                          {col.name}
                                        </span>
                                        <span className={styles.typeLabel}>
                                          {col.data_type}
                                          {col.is_nullable ? '?' : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* VIEWS GROUP */}
                  <div className={styles.subGroup}>
                    <div
                      className={styles.nodeHeader}
                      onClick={() => toggleNode(`${schemaPath}_views`, 'views-group')}
                    >
                      {expandedNodes[`${schemaPath}_views`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.groupLabel}>Views ({views.length})</span>
                    </div>

                    {expandedNodes[`${schemaPath}_views`] && (
                      <div className={styles.nodeChildren}>
                        {views.map((view) => (
                          <div key={view.name} className={styles.leafNode}
                            onClick={() => handleTableClick(view)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, type: 'view', schema: schema.name, tableName: view.name });
                            }}
                          >
                            <Eye size={12} className={styles.viewIcon} />
                            <span className={styles.clickableTitle}>{view.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FUNCTIONS GROUP */}
                  <div className={styles.subGroup}>
                    <div
                      className={styles.nodeHeader}
                      onClick={() => toggleNode(`${schemaPath}_funcs`, 'funcs-group')}
                    >
                      {expandedNodes[`${schemaPath}_funcs`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.groupLabel}>Functions ({schemaFuncs.length})</span>
                    </div>

                    {expandedNodes[`${schemaPath}_funcs`] && (
                      <div className={styles.nodeChildren}>
                        {schemaFuncs.map((func) => (
                          <div key={`${func.name}_${func.argument_types}`} className={styles.leafNode}
                            title={`${func.name}(${func.argument_types}) ➔ ${func.return_type}`}
                            onClick={() => handleViewFunctionProperties(schema.name, func.name, func.argument_types)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                type: 'function',
                                schema: schema.name,
                                functionName: func.name,
                                argumentTypes: func.argument_types
                              });
                            }}
                          >
                            <Code2 size={12} className={styles.funcIcon} />
                            <span className={styles.clickableTitle}>{func.name}</span>
                            <span className={styles.typeLabel} style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
                              ({func.argument_types ? '...' : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SEQUENCES GROUP */}
                  <div className={styles.subGroup}>
                    <div
                      className={styles.nodeHeader}
                      onClick={() => toggleNode(`${schemaPath}_seqs`, 'seqs-group')}
                    >
                      {expandedNodes[`${schemaPath}_seqs`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.groupLabel}>Sequences ({schemaSeqs.length})</span>
                    </div>

                    {expandedNodes[`${schemaPath}_seqs`] && (
                      <div className={styles.nodeChildren}>
                        {schemaSeqs.map((seq) => (
                          <div key={seq.name} className={styles.leafNode}
                            onClick={() => handleViewSequenceProperties(schema.name, seq.name)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                type: 'sequence',
                                schema: schema.name,
                                tableName: seq.name,
                              });
                            }}
                          >
                            <Activity size={12} className={styles.seqIcon} />
                            <span className={styles.clickableTitle}>{seq.name}</span>
                            {seq.last_value !== null && (
                              <span className={styles.typeLabel}>val: {seq.last_value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* EXTENSIONS */}
        {extensions.length > 0 && (
          <div className={styles.subGroup} style={{ marginTop: '12px' }}>
            <div
              className={styles.nodeHeader}
              onClick={() => toggleNode('extensions_group', 'exts-group')}
            >
              {expandedNodes['extensions_group'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Package size={14} className={styles.extIcon} />
              <span>Extensions ({extensions.length})</span>
            </div>

            {expandedNodes['extensions_group'] && (
              <div className={styles.nodeChildren}>
                {extensions.map((ext) => (
                  <div key={ext.name} className={styles.leafNode} title={ext.comment || ''}>
                    <Package size={12} className={styles.leafIcon} />
                    <span>{ext.name}</span>
                    <span className={styles.typeLabel}>v{ext.installed_version}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'schema' && (
            <>
              <button onClick={() => {
                addTab({
                  type: 'editor',
                  title: `Query (${contextMenu.schema})`,
                  schema: contextMenu.schema,
                  sql: '',
                });
                closeContextMenu();
              }}>
                Open Query Editor
              </button>
              <button onClick={() => {
                if (schemas.length > 0) setCreateTableSchema(activeSchema || contextMenu.schema);
                closeContextMenu();
              }}>
                Create Table
              </button>
            </>
          )}
          {contextMenu.type === 'table' && contextMenu.tableName && (
            <>
              <button onClick={() => { handleViewProperties(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                View Properties
              </button>
              <button onClick={() => { handleTableClick({ name: contextMenu.tableName!, schema: contextMenu.schema, is_view: false, is_materialized_view: false, is_partitioned: false, is_foreign: false, row_count_estimate: undefined, comment: undefined }); closeContextMenu(); }}>
                View Data
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleGenerateSelect(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Generate SELECT
              </button>
              <button onClick={() => { handleGenerateInsert(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Generate INSERT
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleCopyTableName(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Copy Table Name
              </button>
              <button onClick={async () => {
                try {
                  const ddl = await invoke<string>('get_table_ddl', { connId: activeId!, schema: contextMenu.schema, table: contextMenu.tableName });
                  navigator.clipboard.writeText(ddl);
                } catch {}
                closeContextMenu();
              }}>
                Copy DDL
              </button>
              <div className={styles.contextDivider} />
              <button className={styles.dangerItem} onClick={() => { handleTruncateTable(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Truncate Table
              </button>
              <button className={styles.dangerItem} onClick={() => { handleDropTable(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Drop Table
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleRenameTable(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Rename Table
              </button>
              <button onClick={() => {
                setAddColumnTarget({ schema: contextMenu.schema, table: contextMenu.tableName! });
                closeContextMenu();
              }}>
                Add Column
              </button>
              <button onClick={() => { handleVacuumTable(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Vacuum
              </button>
              <button onClick={() => { handleAnalyzeTable(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Analyze
              </button>
            </>
          )}
          {contextMenu.type === 'column' && contextMenu.columnName && contextMenu.tableName && (
            <>
              <button onClick={() => { handleCopyColumnName(contextMenu.schema, contextMenu.tableName!, contextMenu.columnName!); closeContextMenu(); }}>
                Copy Column Name
              </button>
              <button onClick={() => { handleCopyColumnFull(contextMenu.schema, contextMenu.tableName!, contextMenu.columnName!); closeContextMenu(); }}>
                Copy Full Path
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleRenameColumn(contextMenu.schema, contextMenu.tableName!, contextMenu.columnName!); closeContextMenu(); }}>
                Rename Column
              </button>
              <button className={styles.dangerItem} onClick={async () => {
                if (!activeId) return;
                if (!confirm(`Drop column "${contextMenu.columnName}" from "${contextMenu.schema}"."${contextMenu.tableName}"?`)) { closeContextMenu(); return; }
                try {
                  await invoke('alter_table_drop_column', { connId: activeId, schema: contextMenu.schema, table: contextMenu.tableName, columnName: contextMenu.columnName });
                  toast(`Column "${contextMenu.columnName}" dropped`, 'success');
                  await fetchTableDetails(activeId, contextMenu.schema, contextMenu.tableName!);
                } catch (err: any) {
                  toast(`Failed to drop column: ${err.message || err}`, 'error');
                }
                closeContextMenu();
              }}>
                Drop Column
              </button>
            </>
          )}
          {contextMenu.type === 'view' && contextMenu.tableName && (
            <>
              <button onClick={() => { handleViewProperties(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                View Properties
              </button>
              <button onClick={() => { handleTableClick({ name: contextMenu.tableName!, schema: contextMenu.schema, is_view: true, is_materialized_view: false, is_partitioned: false, is_foreign: false, row_count_estimate: undefined, comment: undefined }); closeContextMenu(); }}>
                View Data
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleGenerateSelect(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Generate SELECT
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { handleCopyTableName(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Copy View Name
              </button>
              <button onClick={async () => {
                try {
                  const ddl = await invoke<string>('get_table_ddl', { connId: activeId!, schema: contextMenu.schema, table: contextMenu.tableName });
                  navigator.clipboard.writeText(ddl);
                  toast('Copied DDL to clipboard', 'success');
                } catch (err: any) {
                  toast(`Failed to copy DDL: ${err.message || err}`, 'error');
                }
                closeContextMenu();
              }}>
                Copy DDL
              </button>
              <div className={styles.contextDivider} />
              <button className={styles.dangerItem} onClick={() => { 
                const tableMeta = tables[contextMenu.schema]?.find((t) => t.name === contextMenu.tableName);
                handleDropView(contextMenu.schema, contextMenu.tableName!, !!tableMeta?.is_materialized_view); 
                closeContextMenu(); 
              }}>
                Drop View
              </button>
            </>
          )}
          {contextMenu.type === 'function' && contextMenu.functionName && (
            <>
              <button onClick={() => { handleViewFunctionProperties(contextMenu.schema, contextMenu.functionName!, contextMenu.argumentTypes || ''); closeContextMenu(); }}>
                View Properties
              </button>
              <button onClick={() => { handleFunctionClick(contextMenu.schema, contextMenu.functionName!, contextMenu.argumentTypes || ''); closeContextMenu(); }}>
                Open in SQL Editor
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { navigator.clipboard.writeText(`"${contextMenu.schema}"."${contextMenu.functionName}"`); closeContextMenu(); }}>
                Copy Function Name
              </button>
              <button onClick={async () => {
                try {
                  const ddl = await invoke<string>('get_function_ddl', { connId: activeId!, schema: contextMenu.schema, name: contextMenu.functionName, argumentTypes: contextMenu.argumentTypes || '' });
                  navigator.clipboard.writeText(ddl);
                  toast('Copied DDL to clipboard', 'success');
                } catch (err: any) {
                  toast(`Failed to copy DDL: ${err.message || err}`, 'error');
                }
                closeContextMenu();
              }}>
                Copy DDL
              </button>
              <div className={styles.contextDivider} />
              <button className={styles.dangerItem} onClick={() => { handleDropFunction(contextMenu.schema, contextMenu.functionName!, contextMenu.argumentTypes || ''); closeContextMenu(); }}>
                Drop Function
              </button>
            </>
          )}
          {contextMenu.type === 'sequence' && contextMenu.tableName && (
            <>
              <button onClick={() => { handleViewSequenceProperties(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                View Properties
              </button>
              <div className={styles.contextDivider} />
              <button onClick={() => { navigator.clipboard.writeText(`"${contextMenu.schema}"."${contextMenu.tableName}"`); closeContextMenu(); }}>
                Copy Sequence Name
              </button>
              <button onClick={async () => {
                try {
                  const res = await invoke<any>('get_sequence_details', { connId: activeId!, schema: contextMenu.schema, name: contextMenu.tableName! });
                  navigator.clipboard.writeText(res.ddl);
                  toast('Copied DDL to clipboard', 'success');
                } catch (err: any) {
                  toast(`Failed to copy DDL: ${err.message || err}`, 'error');
                }
                closeContextMenu();
              }}>
                Copy DDL
              </button>
              <div className={styles.contextDivider} />
              <button className={styles.dangerItem} onClick={() => { handleDropSequence(contextMenu.schema, contextMenu.tableName!); closeContextMenu(); }}>
                Drop Sequence
              </button>
            </>
          )}
        </div>
      )}

      {createTableSchema && (
        <CreateTableDialog
          schema={createTableSchema}
          isOpen={true}
          onClose={() => setCreateTableSchema(null)}
          onSuccess={() => { if (activeId) fetchSchemas(activeId); }}
        />
      )}

      {addColumnTarget && (
        <AddColumnDialog
          schema={addColumnTarget.schema}
          tableName={addColumnTarget.table}
          isOpen={true}
          onClose={() => setAddColumnTarget(null)}
          onSuccess={() => {
            if (activeId) fetchTableDetails(activeId, addColumnTarget!.schema, addColumnTarget!.table);
          }}
        />
      )}

      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { if (activeId) fetchSchemas(activeId); }}
      />
    </div>
  );
};
export default SchemaTree;
