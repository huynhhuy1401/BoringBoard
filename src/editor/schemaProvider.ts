import { useSchemaStore } from '../stores/schemaStore';
import { useConnectionStore } from '../stores/connectionStore';

export interface SchemaTable {
  schema: string;
  name: string;
  isView: boolean;
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  dataType: string;
  udtName: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface SchemaFunction {
  schema: string;
  name: string;
  args: string;
  returnType: string;
}

/**
 * A live cache over the Zustand schemaStore that flattens schema data
 * into fast lookup structures for the autocomplete provider.
 */
export function getSchemaCache() {
  const schemaState = useSchemaStore.getState();
  const connState = useConnectionStore.getState();
  const activeSchema = connState.activeSchema || 'public';

  // Build flat table list
  const allTables: SchemaTable[] = [];
  for (const [schemaName, tables] of Object.entries(schemaState.tables)) {
    for (const t of tables) {
      const key = `${schemaName}.${t.name}`;
      const cols = (schemaState.columns[key] || []).map((c) => ({
        name: c.name,
        dataType: c.data_type,
        udtName: c.udt_name,
        isPrimaryKey: c.is_primary_key,
        isForeignKey: c.is_foreign_key,
      }));
      allTables.push({
        schema: schemaName,
        name: t.name,
        isView: t.is_view,
        columns: cols,
      });
    }
  }

  // Build flat function list
  const allFunctions: SchemaFunction[] = [];
  for (const [schemaName, funcs] of Object.entries(schemaState.functions)) {
    for (const f of funcs) {
      allFunctions.push({
        schema: schemaName,
        name: f.name,
        args: f.argument_types || '',
        returnType: f.return_type,
      });
    }
  }

  return {
    allTables,
    allFunctions,
    activeSchema,
    schemas: schemaState.schemas.map((s) => s.name),
    databases: schemaState.databases.map((d) => d.name),
  };
}

export type SchemaCache = ReturnType<typeof getSchemaCache>;
