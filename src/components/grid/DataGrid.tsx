import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { QueryResult, DataOptions } from '../../types/query';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { invoke } from '@tauri-apps/api/core';
import { ArrowUp, ArrowDown, Filter, Plus, Trash2, Download, CheckSquare, Square as SquareIcon, Copy, ChevronLeft, ChevronRight, Undo2, Eye, X, Columns3 } from 'lucide-react';
import styles from '../../styles/components/DataGrid.module.css';

interface DataGridProps {
  queryResult: QueryResult;
  schema?: string;
  tableName?: string;
  dataOptions?: DataOptions;
  onDataOptionsChange?: (opts: DataOptions) => void;
  onRefresh?: () => void;
}

type SortDir = 'ASC' | 'DESC' | undefined;

interface PendingEdit {
  type: 'update';
  rowIndex: number;
  colIndex: number;
  columnName: string;
  oldValue: any;
  newValue: any;
  pkValue: any;
}

interface PendingInsert {
  type: 'insert';
  data: Record<string, any>;
}

interface PendingDelete {
  type: 'delete';
  rowIndex: number;
  pkValue: any;
}

type PendingChange = PendingEdit | PendingInsert | PendingDelete;

const FILTER_OPERATORS = [
  { value: 'contains', label: 'Contains', symbol: 'ILIKE' },
  { value: 'equals', label: 'Equals', symbol: '=' },
  { value: 'not_equals', label: 'Not Equals', symbol: '!=' },
  { value: 'starts_with', label: 'Starts With', symbol: 'LIKE' },
  { value: 'ends_with', label: 'Ends With', symbol: 'LIKE' },
  { value: 'greater', label: 'Greater Than', symbol: '>' },
  { value: 'greater_equal', label: 'Greater or Equal', symbol: '>=' },
  { value: 'less', label: 'Less Than', symbol: '<' },
  { value: 'less_equal', label: 'Less or Equal', symbol: '<=' },
  { value: 'is_null', label: 'Is NULL', symbol: 'IS NULL' },
  { value: 'is_not_null', label: 'Is Not NULL', symbol: 'IS NOT NULL' },
];

export const DataGrid: React.FC<DataGridProps> = ({
  queryResult,
  schema,
  tableName,
  dataOptions,
  onDataOptionsChange,
  onRefresh,
}) => {
  const { activeId } = useConnectionStore();
  const { columns: schemaColumns } = useSchemaStore();
  const parentRef = useRef<HTMLDivElement>(null);

  // Cell editing states
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Column widths
  const [customWidths, setCustomWidths] = useState<Record<number, number>>({});

  // Sorting state
  const [clientSortCol, setClientSortCol] = useState<string | undefined>();
  const [clientSortDir, setClientSortDir] = useState<SortDir>();

  // Filter state
  const [filterOpen, setFilterOpen] = useState<number | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [filterOperators, setFilterOperators] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<{ column?: string; value?: string; operator?: string }>({});

  // Selection for delete
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Change tracking
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [undoStack, setUndoStack] = useState<PendingChange[][]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number; value: any } | null>(null);

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const isTableTab = !!(schema && tableName);
  const { columns, rows: allRows } = queryResult;

  // Primary key info
  const pkColumn = useMemo(() => {
    if (!schema || !tableName) return null;
    const key = `${schema}.${tableName}`;
    const tableCols = schemaColumns[key] || [];
    return tableCols.find((c) => c.is_primary_key)?.name || null;
  }, [schema, tableName, schemaColumns]);

  const pkColumnIndex = useMemo(() => {
    if (!pkColumn) return -1;
    return columns.findIndex((c) => c.name === pkColumn);
  }, [pkColumn, columns]);

  // Fetch table details on mount so PK is known for editing
  useEffect(() => {
    if (!schema || !tableName || !activeId) return;
    const key = `${schema}.${tableName}`;
    if (!schemaColumns[key] || schemaColumns[key].length === 0) {
      useSchemaStore.getState().fetchTableDetails(activeId, schema, tableName);
    }
  }, [schema, tableName, activeId]);

  // --- Change tracking ---
  const pendingCount = pendingChanges.length;

  const pushChange = (change: PendingChange) => {
    setUndoStack((prev) => [...prev, pendingChanges]);
    setPendingChanges((prev) => [...prev, change]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setPendingChanges(prev);
  };

  const handleDiscard = () => {
    setPendingChanges([]);
    setUndoStack([]);
    setShowPendingPanel(false);
  };

  const handleCommit = async () => {
    if (!activeId || !schema || !tableName) return;
    try {
      for (const change of pendingChanges) {
        if (change.type === 'update') {
          await invoke('update_row', {
            connId: activeId, schema, table: tableName, pkColumn, pkValue: change.pkValue,
            changes: { [change.columnName]: change.newValue },
          });
        } else if (change.type === 'insert') {
          await invoke('insert_row', {
            connId: activeId, schema, table: tableName, data: change.data,
          });
        } else if (change.type === 'delete') {
          await invoke('delete_rows', {
            connId: activeId, schema, table: tableName, pkColumn, pkValues: [change.pkValue],
          });
        }
      }
      setPendingChanges([]);
      setUndoStack([]);
      setShowPendingPanel(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to commit changes: ${err.message || err}`);
    }
  };

  // Listen for commit-changes event from keyboard shortcut (Cmd+S)
  useEffect(() => {
    const handler = () => {
      if (pendingChanges.length > 0) handleCommit();
    };
    window.addEventListener('bb:commit-changes', handler);
    return () => window.removeEventListener('bb:commit-changes', handler);
  }, [pendingChanges]);

  // Listen for undo-changes event from keyboard shortcut (Cmd+Z)
  useEffect(() => {
    const handler = () => {
      if (pendingChanges.length > 0) handleUndo();
    };
    window.addEventListener('bb:undo-changes', handler);
    return () => window.removeEventListener('bb:undo-changes', handler);
  }, [pendingChanges, undoStack]);

  const generatePreviewSql = (): string => {
    return pendingChanges.map((change) => {
      if (change.type === 'update') {
        const val = change.newValue === null ? 'NULL' : typeof change.newValue === 'string' ? `'${change.newValue.replace(/'/g, "''")}'` : String(change.newValue);
        return `UPDATE "${schema}"."${tableName}" SET "${change.columnName}" = ${val} WHERE "${pkColumn}" = ${formatSqlVal(change.pkValue)};`;
      } else if (change.type === 'insert') {
        const cols = Object.keys(change.data).map((c) => `"${c}"`).join(', ');
        const vals = Object.values(change.data).map(formatSqlVal).join(', ');
        return `INSERT INTO "${schema}"."${tableName}" (${cols}) VALUES (${vals});`;
      } else {
        return `DELETE FROM "${schema}"."${tableName}" WHERE "${pkColumn}" = ${formatSqlVal(change.pkValue)};`;
      }
    }).join('\n');
  };

  // --- Sorting ---
  const currentSortCol = isTableTab ? dataOptions?.sort_column : clientSortCol;
  const currentSortDir = isTableTab ? dataOptions?.sort_direction : clientSortDir;

  const handleHeaderClick = useCallback((colName: string) => {
    if (isTableTab && onDataOptionsChange) {
      const newDir: SortDir = dataOptions?.sort_column !== colName ? 'ASC'
        : dataOptions?.sort_direction === 'ASC' ? 'DESC'
        : undefined;
      onDataOptionsChange({
        ...dataOptions,
        sort_column: newDir ? colName : undefined,
        sort_direction: newDir,
        offset: 0,
      });
    } else {
      setClientSortCol((prev) => prev !== colName ? colName : undefined);
      setClientSortDir((prev) => {
        if (clientSortCol !== colName) return 'ASC';
        if (prev === 'ASC') return 'DESC';
        return undefined;
      });
    }
  }, [isTableTab, dataOptions, onDataOptionsChange, clientSortCol]);

  // --- Filtering ---
  const toggleFilter = (colIndex: number) => {
    setFilterOpen((prev) => prev === colIndex ? null : colIndex);
  };

  const applyFilter = (colName: string, value: string, operator?: string) => {
    const op = operator || filterOperators[colName] || 'contains';
    setFilterValues((prev) => ({ ...prev, [colName]: value }));
    setFilterOperators((prev) => ({ ...prev, [colName]: op }));
    setActiveFilter({ column: colName, value, operator: op });
    if (isTableTab && onDataOptionsChange) {
      onDataOptionsChange({
        ...dataOptions,
        filter_column: value || op === 'is_null' || op === 'is_not_null' ? colName : undefined,
        filter_value: value || undefined,
        filter_operator: op,
        offset: 0,
      });
    }
    setFilterOpen(null);
  };

  const clearAllFilters = () => {
    setFilterValues({});
    setFilterOperators({});
    setActiveFilter({});
    if (isTableTab && onDataOptionsChange) {
      onDataOptionsChange({
        ...dataOptions,
        filter_column: undefined,
        filter_value: undefined,
        filter_operator: undefined,
        offset: 0,
      });
    }
  };

  // --- Client-side data processing ---
  const processedRows = useMemo(() => {
    let result = [...allRows];

    if (!isTableTab && activeFilter.column && (activeFilter.value || activeFilter.operator === 'is_null' || activeFilter.operator === 'is_not_null')) {
      const colIdx = columns.findIndex((c) => c.name === activeFilter.column);
      if (colIdx >= 0) {
        const op = activeFilter.operator || 'contains';
        const val = activeFilter.value || '';
        result = result.filter((row) => {
          const cellVal = row[colIdx];
          if (op === 'is_null') return cellVal === null;
          if (op === 'is_not_null') return cellVal !== null;
          if (cellVal === null) return false;
          const str = String(cellVal).toLowerCase();
          const lower = val.toLowerCase();
          switch (op) {
            case 'contains': return str.includes(lower);
            case 'equals': return str === lower;
            case 'not_equals': return str !== lower;
            case 'starts_with': return str.startsWith(lower);
            case 'ends_with': return str.endsWith(lower);
            case 'greater': return Number(cellVal) > Number(val);
            case 'greater_equal': return Number(cellVal) >= Number(val);
            case 'less': return Number(cellVal) < Number(val);
            case 'less_equal': return Number(cellVal) <= Number(val);
            default: return str.includes(lower);
          }
        });
      }
    }

    if (!isTableTab && clientSortCol && clientSortDir) {
      const colIdx = columns.findIndex((c) => c.name === clientSortCol);
      if (colIdx >= 0) {
        result.sort((a, b) => {
          const va = a[colIdx], vb = b[colIdx];
          if (va === null && vb === null) return 0;
          if (va === null) return clientSortDir === 'ASC' ? -1 : 1;
          if (vb === null) return clientSortDir === 'ASC' ? 1 : -1;
          const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
          return clientSortDir === 'ASC' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [allRows, columns, activeFilter, clientSortCol, clientSortDir, isTableTab]);

  // --- Pagination ---
  const paginatedRows = useMemo(() => {
    if (isTableTab) return processedRows;
    const start = page * rowsPerPage;
    return processedRows.slice(start, start + rowsPerPage);
  }, [processedRows, page, rowsPerPage, isTableTab]);

  const totalPages = isTableTab ? 1000 : Math.ceil(processedRows.length / rowsPerPage);
  const displayRows = paginatedRows;
  const rows = displayRows;

  // --- Row Selection ---
  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((_, i) => i)));
    }
  };

  // --- Delete rows ---
  const handleDeleteSelected = async () => {
    if (!activeId || !schema || !tableName || pkColumnIndex === -1) return;
    try {
      const pkValues = Array.from(selectedRows).map((i) => rows[i][pkColumnIndex]);
      await invoke('delete_rows', {
        connId: activeId, schema, table: tableName, pkColumn, pkValues,
      });
      setSelectedRows(new Set());
      setShowDeleteConfirm(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to delete rows: ${err.message || err}`);
    }
  };

  // --- Insert row ---
  const [insertFormData, setInsertFormData] = useState<Record<string, string>>({});
  const handleInsertRow = async () => {
    if (!activeId || !schema || !tableName) return;
    try {
      const data: Record<string, any> = {};
      for (const [col, val] of Object.entries(insertFormData)) {
        if (val.trim() === '') continue;
        data[col] = val;
      }
      await invoke('insert_row', {
        connId: activeId, schema, table: tableName, data,
      });
      setShowInsertModal(false);
      setInsertFormData({});
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to insert row: ${err.message || err}`);
    }
  };

  // --- Export ---
  const exportToCsv = () => {
    const header = columns.map((c) => c.name).join(',');
    const csvRows = rows.map((row) =>
      row.map((cell) => {
        if (cell === null) return '';
        const s = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    );
    downloadFile([header, ...csvRows].join('\n'), 'export.csv', 'text/csv');
    setShowExportMenu(false);
  };

  const exportToJson = () => {
    const header = columns.map((c) => c.name);
    const jsonRows = rows.map((row) => {
      const obj: Record<string, any> = {};
      row.forEach((cell, i) => { obj[header[i]] = cell; });
      return obj;
    });
    downloadFile(JSON.stringify(jsonRows, null, 2), 'export.json', 'application/json');
    setShowExportMenu(false);
  };

  const exportToSql = () => {
    const tableName_ = tableName || 'table';
    const schema_ = schema || 'public';
    const sqlStatements = rows.map((row) => {
      const cols = columns.map((c) => `"${c.name}"`).join(', ');
      const vals = row.map((cell) => formatSqlVal(cell)).join(', ');
      return `INSERT INTO "${schema_}"."${tableName_}" (${cols}) VALUES (${vals});`;
    });
    const header = `-- Exported from BoringBoard\n-- Table: ${schema_}.${tableName_}\n-- Rows: ${rows.length}\n\n`;
    downloadFile(header + sqlStatements.join('\n'), `${tableName_}.sql`, 'application/sql');
    setShowExportMenu(false);
  };

  const copyAsCsv = async () => {
    const header = columns.map((c) => c.name).join('\t');
    const tsvRows = rows.map((row) =>
      row.map((cell) => {
        if (cell === null) return 'NULL';
        return typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
      }).join('\t')
    );
    await navigator.clipboard.writeText([header, ...tsvRows].join('\n'));
    setShowExportMenu(false);
  };

  const copyAsJson = async () => {
    const header = columns.map((c) => c.name);
    const jsonRows = rows.map((row) => {
      const obj: Record<string, any> = {};
      row.forEach((cell, i) => { obj[header[i]] = cell; });
      return obj;
    });
    await navigator.clipboard.writeText(JSON.stringify(jsonRows, null, 2));
    setShowExportMenu(false);
  };

  const copyAsMarkdown = async () => {
    const header = `| ${columns.map((c) => c.name).join(' | ')} |`;
    const sep = `| ${columns.map(() => '---').join(' | ')} |`;
    const mdRows = rows.map((row) =>
      `| ${row.map((cell) => cell === null ? 'NULL' : String(cell)).join(' | ')} |`
    );
    await navigator.clipboard.writeText([header, sep, ...mdRows].join('\n'));
    setShowExportMenu(false);
  };

  const copyAsInsertSql = async () => {
    const tableName_ = tableName || 'table';
    const schema_ = schema || 'public';
    const sqlStatements = rows.map((row) => {
      const cols = columns.map((c) => `"${c.name}"`).join(', ');
      const vals = row.map((cell) => formatSqlVal(cell)).join(', ');
      return `INSERT INTO "${schema_}"."${tableName_}" (${cols}) VALUES (${vals});`;
    });
    await navigator.clipboard.writeText(sqlStatements.join('\n'));
    setShowExportMenu(false);
  };

  // --- Context menu ---
  const handleContextMenu = (e: React.MouseEvent, rowIndex: number, colIndex: number, value: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex, value });
  };

  const closeContextMenu = () => setContextMenu(null);

  const copyCellValue = async () => {
    if (!contextMenu) return;
    const val = contextMenu.value;
    const text = val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
    await navigator.clipboard.writeText(text);
    closeContextMenu();
  };

  const copyRowAsJson = async () => {
    if (!contextMenu) return;
    const row = rows[contextMenu.rowIndex];
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col.name] = row[i]; });
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    closeContextMenu();
  };

  const copyRowAsInsert = async () => {
    if (!contextMenu) return;
    const row = rows[contextMenu.rowIndex];
    const tableName_ = tableName || 'table';
    const schema_ = schema || 'public';
    const cols = columns.map((c) => `"${c.name}"`).join(', ');
    const vals = row.map((cell) => formatSqlVal(cell)).join(', ');
    await navigator.clipboard.writeText(`INSERT INTO "${schema_}"."${tableName_}" (${cols}) VALUES (${vals});`);
    closeContextMenu();
  };

  const copyRowAsTsv = async () => {
    if (!contextMenu) return;
    const row = rows[contextMenu.rowIndex];
    const header = columns.map((c) => c.name).join('\t');
    const values = row.map((cell) => cell === null ? 'NULL' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell)).join('\t');
    await navigator.clipboard.writeText([header, values].join('\n'));
    closeContextMenu();
  };

  const handleSetNull = async () => {
    if (!contextMenu || !activeId || !schema || !tableName || pkColumnIndex === -1) return;
    const row = rows[contextMenu.rowIndex];
    const pkValue = row[pkColumnIndex];
    const columnName = columns[contextMenu.colIndex].name;
    pushChange({
      type: 'update',
      rowIndex: contextMenu.rowIndex,
      colIndex: contextMenu.colIndex,
      columnName,
      oldValue: row[contextMenu.colIndex],
      newValue: null,
      pkValue,
    });
    // Update local display via updateTab to trigger re-render
    row[contextMenu.colIndex] = null;
    closeContextMenu();
  };

  const handleDeleteSingleRow = async () => {
    if (!contextMenu || !activeId || !schema || !tableName || pkColumnIndex === -1) return;
    const row = rows[contextMenu.rowIndex];
    const pkValue = row[pkColumnIndex];
    try {
      await invoke('delete_rows', {
        connId: activeId, schema, table: tableName, pkColumn, pkValues: [pkValue],
      });
      closeContextMenu();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to delete row: ${err.message || err}`);
      closeContextMenu();
    }
  };

  // --- Virtualizer ---
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 15,
  });

  // --- Cell editing ---
  const handleCellDoubleClick = (rowIndex: number, colIndex: number, currentValue: any) => {
    if (!activeId || !schema || !tableName) return;
    if (pkColumnIndex === -1) return;
    setEditingCell({ rowIndex, colIndex });
    setEditValue(currentValue === null ? '' : String(currentValue));
  };

  const handleCellSave = async (rowIndex: number, colIndex: number) => {
    if (!activeId || !schema || !tableName || pkColumnIndex === -1) return;
    const columnName = columns[colIndex].name;
    const row = rows[rowIndex];
    const pkValue = row[pkColumnIndex];
    const oldValue = row[colIndex];

    // Skip if value didn't change
    if (String(oldValue) === editValue) {
      setEditingCell(null);
      return;
    }

    // Queue the change instead of saving immediately
    pushChange({
      type: 'update',
      rowIndex,
      colIndex,
      columnName,
      oldValue,
      newValue: editValue,
      pkValue,
    });

    // Update local display
    row[colIndex] = editValue;
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') handleCellSave(rowIndex, colIndex);
    else if (e.key === 'Escape') setEditingCell(null);
  };

  // --- Column resize ---
  const handleResizeStart = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colIndex];
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setCustomWidths((prev) => ({ ...prev, [colIndex]: Math.max(60, startWidth + moveEvent.clientX - startX) }));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeDoubleClick = (colIndex: number) => {
    const col = columns[colIndex];
    let maxLen = Math.max(col.name.length, col.data_type.length);
    const scanLimit = Math.min(rows.length, 1000);
    for (let i = 0; i < scanLimit; i++) {
      const val = rows[i][colIndex];
      if (val !== null) {
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        if (strVal.length > maxLen) maxLen = strVal.length;
      }
    }
    setCustomWidths((prev) => ({ ...prev, [colIndex]: Math.max(100, Math.min(800, Math.round(maxLen * 8 + 32))) }));
  };

  const renderCellContent = (value: any) => {
    if (value === null) return <span className={styles.nullValue}>NULL</span>;
    if (typeof value === 'object') return <span className={styles.objectValue}>{JSON.stringify(value)}</span>;
    return String(value);
  };

  // Column widths
  const columnWidths = useMemo(() => {
    return columns.map((col, colIndex) => {
      if (customWidths[colIndex] !== undefined) return customWidths[colIndex];
      let maxLen = Math.max(col.name.length, col.data_type.length);
      const scanLimit = Math.min(rows.length, 1000);
      for (let i = 0; i < scanLimit; i++) {
        const val = rows[i][colIndex];
        if (val !== null) {
          const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
          if (strVal.length > maxLen) maxLen = strVal.length;
        }
      }
      return Math.max(100, Math.min(450, Math.round(maxLen * 8 + 24)));
    });
  }, [columns, rows, customWidths]);

  const gridTemplateColumns = useMemo(() => {
    const rowPrefix = isTableTab ? '30px' : '50px';
    const visibleWidths = columnWidths
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => !hiddenColumns.has(i))
      .map(({ w }) => `${w}px`);
    return [rowPrefix, ...visibleWidths].join(' ');
  }, [columnWidths, isTableTab, hiddenColumns]);

  // Table columns with schema info for insert form
  const tableColDetails = useMemo(() => {
    if (!schema || !tableName) return [];
    const key = `${schema}.${tableName}`;
    return schemaColumns[key] || [];
  }, [schema, tableName, schemaColumns]);

  return (
    <div className={styles.gridContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.rowCount}>
            {isTableTab ? `${rows.length} rows` : `${processedRows.length} rows`}
            {queryResult.execution_time_ms > 0 && (
              <span className={styles.execTime}> · {queryResult.execution_time_ms}ms</span>
            )}
          </span>
          {activeFilter.column && (
            <span className={styles.filterBadge}>
              {activeFilter.column} {activeFilter.operator === 'is_null' ? 'IS NULL' : activeFilter.operator === 'is_not_null' ? 'IS NOT NULL' : `${FILTER_OPERATORS.find(o => o.value === activeFilter.operator)?.symbol || 'ILIKE'} '${activeFilter.value}'`}
              <button className={styles.clearFilterBtn} onClick={clearAllFilters}>×</button>
            </span>
          )}
          {pendingCount > 0 && (
            <span className={styles.pendingBadge}>
              {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          {pendingCount > 0 && (
            <>
              <button className={styles.toolbarBtn} onClick={handleUndo} title="Undo (Cmd+Z)">
                <Undo2 size={14} />
              </button>
              <button className={styles.toolbarBtn} onClick={() => setShowPendingPanel(!showPendingPanel)} title="Preview SQL">
                <Eye size={14} /> SQL
              </button>
              <button className={styles.toolbarBtn} onClick={handleDiscard} title="Discard all changes">
                <X size={14} /> Discard
              </button>
              <button className={`${styles.toolbarBtn} ${styles.commitBtn}`} onClick={handleCommit} title="Commit all changes (Cmd+S)">
                Commit ({pendingCount})
              </button>
            </>
          )}
          {isTableTab && (
            <>
              <button className={styles.toolbarBtn} onClick={() => { setInsertFormData({}); setShowInsertModal(true); }} title="Add Row">
                <Plus size={14} /> Add Row
              </button>
              <button
                className={styles.toolbarBtn}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedRows.size === 0}
                title="Delete Selected"
              >
                <Trash2 size={14} /> Delete ({selectedRows.size})
              </button>
            </>
          )}
          <div className={styles.exportWrapper}>
            <button className={styles.toolbarBtn} onClick={() => { setShowColumnMenu(!showColumnMenu); setShowExportMenu(false); }} title="Column Visibility">
              <Columns3 size={14} />
            </button>
            {showColumnMenu && (
              <div className={styles.exportMenu}>
                {columns.map((col, idx) => (
                  <label key={col.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(idx)}
                      onChange={() => {
                        setHiddenColumns((prev) => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                    />
                    {col.name}
                  </label>
                ))}
                {hiddenColumns.size > 0 && (
                  <button onClick={() => setHiddenColumns(new Set())} style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 6 }}>
                    Show All
                  </button>
                )}
              </div>
            )}
          </div>
          <div className={styles.exportWrapper}>
            <button className={styles.toolbarBtn} onClick={() => { setShowExportMenu(!showExportMenu); setShowColumnMenu(false); }} title="Export">
              <Download size={14} /> Export
            </button>
            {showExportMenu && (
              <div className={styles.exportMenu}>
                <button onClick={exportToCsv}><Download size={12} /> Export CSV</button>
                <button onClick={exportToJson}><Download size={12} /> Export JSON</button>
                <button onClick={exportToSql}><Download size={12} /> Export SQL</button>
                <div className={styles.exportDivider} />
                <button onClick={copyAsCsv}><Copy size={12} /> Copy as TSV</button>
                <button onClick={copyAsJson}><Copy size={12} /> Copy as JSON</button>
                <button onClick={copyAsMarkdown}><Copy size={12} /> Copy as Markdown</button>
                <button onClick={copyAsInsertSql}><Copy size={12} /> Copy as INSERT SQL</button>
              </div>
            )}
          </div>
          {onRefresh && (
            <button className={styles.toolbarBtn} onClick={onRefresh} title="Refresh">↻</button>
          )}
        </div>
      </div>

      {/* Pending changes panel */}
      {showPendingPanel && pendingCount > 0 && (
        <div className={styles.pendingPanel}>
          <div className={styles.pendingPanelHeader}>
            <span>Pending Changes ({pendingCount})</span>
            <button className={styles.pendingPanelClose} onClick={() => setShowPendingPanel(false)}><X size={14} /></button>
          </div>
          <pre className={styles.pendingSql}>{generatePreviewSql()}</pre>
        </div>
      )}

      {/* Main grid */}
      <div ref={parentRef} className={styles.tableScroll} onClick={closeContextMenu}>
        {/* Header */}
        <div
          className={styles.headerRow}
          style={{ display: 'grid', gridTemplateColumns, position: 'sticky', top: 0, zIndex: 10, width: 'max-content', minWidth: '100%' }}
        >
          {isTableTab && (
            <div className={styles.rowNumberHeader} onClick={toggleAllRows} style={{ cursor: 'pointer' }}>
              {selectedRows.size === rows.length && rows.length > 0 ? <CheckSquare size={14} /> : <SquareIcon size={14} />}
            </div>
          )}
          {!isTableTab && <div className={styles.rowNumberHeader}>#</div>}
          {columns.map((col, index) => {
            if (hiddenColumns.has(index)) return null;
            return (
            <div key={col.name} className={styles.headerCell} style={{ position: 'relative' }}>
              <div className={styles.headerContent} onClick={() => handleHeaderClick(col.name)} style={{ cursor: 'pointer' }}>
                <span className={styles.columnName}>
                  {col.name}
                  {currentSortCol === col.name && currentSortDir === 'ASC' && <ArrowUp size={12} className={styles.sortArrow} />}
                  {currentSortCol === col.name && currentSortDir === 'DESC' && <ArrowDown size={12} className={styles.sortArrow} />}
                </span>
                <span className={styles.columnType}>{col.data_type}</span>
              </div>
              <button
                className={`${styles.filterBtn} ${activeFilter.column === col.name ? styles.filterActive : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleFilter(index); }}
                title="Filter"
              >
                <Filter size={10} />
              </button>
              {filterOpen === index && (
                <div className={styles.filterPopover}>
                  <select
                    className={styles.filterOperatorSelect}
                    value={filterOperators[col.name] || 'contains'}
                    onChange={(e) => setFilterOperators((prev) => ({ ...prev, [col.name]: e.target.value }))}
                  >
                    {FILTER_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label} ({op.symbol})</option>
                    ))}
                  </select>
                  {(filterOperators[col.name] || 'contains') !== 'is_null' && (filterOperators[col.name] || 'contains') !== 'is_not_null' && (
                    <input
                      type="text"
                      placeholder={`Filter ${col.name}...`}
                      value={filterValues[col.name] || ''}
                      onChange={(e) => setFilterValues((prev) => ({ ...prev, [col.name]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(col.name, filterValues[col.name] || '', filterOperators[col.name]); }}
                      autoFocus
                      className={styles.filterInput}
                    />
                  )}
                  <div className={styles.filterActions}>
                    <button onClick={() => applyFilter(col.name, filterValues[col.name] || '', filterOperators[col.name])}>Apply</button>
                    <button onClick={() => applyFilter(col.name, '', 'contains')}>Clear</button>
                  </div>
                </div>
              )}
              <div className={styles.colResizer} onMouseDown={(e) => handleResizeStart(e, index)} onDoubleClick={() => handleResizeDoubleClick(index)} title="Double-click to auto-fit, drag to resize" />
            </div>
            );
          })}
        </div>

        {/* Rows */}
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: 'max-content', minWidth: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const hasPendingEdit = pendingChanges.some((c) => c.type === 'update' && c.rowIndex === virtualRow.index);
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute', top: 0, left: 0, width: 'max-content', minWidth: '100%',
                  height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid', gridTemplateColumns,
                }}
                className={`${styles.row} ${hasPendingEdit ? styles.rowModified : ''} ${selectedRows.has(virtualRow.index) ? styles.rowSelected : ''}`}
              >
                {isTableTab && (
                  <div className={styles.rowNumber} onClick={() => toggleRowSelection(virtualRow.index)} style={{ cursor: 'pointer' }}>
                    {selectedRows.has(virtualRow.index) ? <CheckSquare size={13} /> : <SquareIcon size={13} />}
                  </div>
                )}
                {!isTableTab && <div className={styles.rowNumber}>{virtualRow.index + 1 + (isTableTab ? 0 : page * rowsPerPage)}</div>}
                {row.map((cell, colIndex) => {
                  if (hiddenColumns.has(colIndex)) return null;
                  const isEditing = editingCell?.rowIndex === virtualRow.index && editingCell?.colIndex === colIndex;
                  const hasCellEdit = pendingChanges.some((c) => c.type === 'update' && c.rowIndex === virtualRow.index && c.colIndex === colIndex);
                  return (
                    <div
                      key={colIndex}
                      className={`${styles.cell} ${pkColumnIndex === colIndex ? styles.pkCell : ''} ${hasCellEdit ? styles.cellModified : ''} ${isTableTab ? styles.cellEditable : ''}`}
                      onDoubleClick={() => isTableTab && handleCellDoubleClick(virtualRow.index, colIndex, cell)}
                      onContextMenu={(e) => handleContextMenu(e, virtualRow.index, colIndex, cell)}
                    >
                      {isEditing ? (
                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCellSave(virtualRow.index, colIndex)}
                          onKeyDown={(e) => handleKeyDown(e, virtualRow.index, colIndex)} autoFocus className={styles.cellInput} />
                      ) : (renderCellContent(cell))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={copyCellValue}><Copy size={12} /> Copy Cell Value</button>
          <button onClick={copyRowAsJson}><Copy size={12} /> Copy Row as JSON</button>
          <button onClick={copyRowAsInsert}><Copy size={12} /> Copy Row as INSERT</button>
          <button onClick={copyRowAsTsv}><Copy size={12} /> Copy Row as TSV</button>
          {isTableTab && pkColumnIndex !== -1 && (
            <>
              <div className={styles.exportDivider} />
              <button onClick={handleSetNull}>Set NULL</button>
              <button onClick={handleDeleteSingleRow} className={styles.dangerContextItem}>Delete Row</button>
            </>
          )}
        </div>
      )}

      {/* Pagination toolbar (for query results) */}
      {!isTableTab && totalPages > 1 && (
        <div className={styles.pagination}>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} className={styles.pageSizeSelect}>
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <span className={styles.pageInfo}>Page {page + 1} of {totalPages}</span>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={styles.pageBtn}><ChevronLeft size={14} /></button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className={styles.pageBtn}><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Table pagination (backend-driven) */}
      {isTableTab && onDataOptionsChange && (
        <div className={styles.pagination}>
          <select
            value={dataOptions?.limit || 100}
            onChange={(e) => onDataOptionsChange({ ...dataOptions, limit: Number(e.target.value), offset: 0 })}
            className={styles.pageSizeSelect}
          >
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <span className={styles.pageInfo}>
            Rows {((dataOptions?.offset || 0)) + 1}–{((dataOptions?.offset || 0)) + rows.length}
            {queryResult.total_count != null && (
              <> of {queryResult.total_count.toLocaleString()}</>
            )}
          </span>
          <button
            disabled={!dataOptions?.offset || dataOptions.offset === 0}
            onClick={() => onDataOptionsChange({ ...dataOptions, offset: Math.max(0, (dataOptions?.offset || 0) - (dataOptions?.limit || 100)) })}
            className={styles.pageBtn}
          ><ChevronLeft size={14} /></button>
          <button
            disabled={rows.length < (dataOptions?.limit || 100) || (queryResult.total_count != null && (dataOptions?.offset || 0) + rows.length >= queryResult.total_count)}
            onClick={() => onDataOptionsChange({ ...dataOptions, offset: (dataOptions?.offset || 0) + (dataOptions?.limit || 100) })}
            className={styles.pageBtn}
          ><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Insert Modal */}
      {showInsertModal && (
        <div className={styles.modalOverlay} onClick={() => setShowInsertModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Insert Row — {schema}.{tableName}</h3>
            <div className={styles.insertForm}>
              {tableColDetails.filter((c) => !c.is_identity && !c.is_generated).map((col) => (
                <div key={col.name} className={styles.insertField}>
                  <label>
                    {col.name}
                    <span className={styles.fieldType}>{col.data_type}{col.is_nullable ? '' : ' *'}</span>
                  </label>
                  <input
                    type="text"
                    value={insertFormData[col.name] || ''}
                    onChange={(e) => setInsertFormData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                    placeholder={col.column_default ? `Default: ${col.column_default}` : col.is_nullable ? 'NULL' : 'Required'}
                  />
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowInsertModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleInsertRow}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Delete Rows</h3>
            <p>Are you sure you want to delete {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} from {schema}.{tableName}?</p>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatSqlVal(val: any): string {
  if (val === null) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default DataGrid;
