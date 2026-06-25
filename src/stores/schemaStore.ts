import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Database, Schema, Table, Column, Index, Constraint, Trigger, Function, Sequence, Extension } from '../types/schema';

interface SchemaState {
  databases: Database[];
  schemas: Schema[];
  tables: Record<string, Table[]>; // schemaName -> Table[]
  columns: Record<string, Column[]>; // "schema.table" -> Column[]
  indexes: Record<string, Index[]>; // "schema.table" -> Index[]
  constraints: Record<string, Constraint[]>; // "schema.table" -> Constraint[]
  triggers: Record<string, Trigger[]>; // "schema.table" -> Trigger[]
  functions: Record<string, Function[]>; // schemaName -> Function[]
  sequences: Record<string, Sequence[]>; // schemaName -> Sequence[]
  extensions: Extension[];
  loadingDbs: boolean;
  loadingSchemas: boolean;
  loadingTables: Record<string, boolean>;
  loadingDetails: Record<string, boolean>; // "schema.table" -> boolean
  error: string | null;
  fetchDatabases: (connId: string) => Promise<void>;
  fetchSchemas: (connId: string) => Promise<void>;
  fetchTables: (connId: string, schema: string) => Promise<void>;
  fetchTableDetails: (connId: string, schema: string, table: string) => Promise<void>;
  fetchFunctions: (connId: string, schema: string) => Promise<void>;
  fetchSequences: (connId: string, schema: string) => Promise<void>;
  fetchExtensions: (connId: string) => Promise<void>;
  clearSchemaCache: () => void;
}

export const useSchemaStore = create<SchemaState>((set) => ({
  databases: [],
  schemas: [],
  tables: {},
  columns: {},
  indexes: {},
  constraints: {},
  triggers: {},
  functions: {},
  sequences: {},
  extensions: [],
  loadingDbs: false,
  loadingSchemas: false,
  loadingTables: {},
  loadingDetails: {},
  error: null,

  fetchDatabases: async (connId) => {
    set({ loadingDbs: true, error: null });
    try {
      const databases = await invoke<Database[]>('get_databases', { connId });
      set({ databases, loadingDbs: false });
    } catch (err: any) {
      console.error('Failed to fetch databases', err);
      const errMsg = err.message || err.toString();
      set({ error: errMsg, loadingDbs: false });
      throw err;
    }
  },

  fetchSchemas: async (connId) => {
    set({ loadingSchemas: true, error: null });
    try {
      const schemas = await invoke<Schema[]>('get_schemas', { connId });
      set({ schemas, loadingSchemas: false });
    } catch (err: any) {
      console.error('Failed to fetch schemas', err);
      const errMsg = err.message || err.toString();
      set({ error: errMsg, loadingSchemas: false });
      throw err;
    }
  },

  fetchTables: async (connId, schema) => {
    set((state) => ({
      loadingTables: { ...state.loadingTables, [schema]: true },
      error: null,
    }));
    try {
      const tables = await invoke<Table[]>('get_tables', { connId, schema });
      set((state) => ({
        tables: { ...state.tables, [schema]: tables },
        loadingTables: { ...state.loadingTables, [schema]: false },
      }));
    } catch (err: any) {
      console.error(`Failed to fetch tables for schema ${schema}`, err);
      const errMsg = err.message || err.toString();
      set((state) => ({
        error: errMsg,
        loadingTables: { ...state.loadingTables, [schema]: false },
      }));
      throw err;
    }
  },

  fetchTableDetails: async (connId, schema, table) => {
    const key = `${schema}.${table}`;
    set((state) => ({
      loadingDetails: { ...state.loadingDetails, [key]: true },
      error: null,
    }));
    try {
      const [columns, indexes, constraints, triggers] = await Promise.all([
        invoke<Column[]>('get_columns', { connId, schema, table }),
        invoke<Index[]>('get_indexes', { connId, schema, table }),
        invoke<Constraint[]>('get_constraints', { connId, schema, table }),
        invoke<Trigger[]>('get_triggers', { connId, schema, table }),
      ]);
      set((state) => ({
        columns: { ...state.columns, [key]: columns },
        indexes: { ...state.indexes, [key]: indexes },
        constraints: { ...state.constraints, [key]: constraints },
        triggers: { ...state.triggers, [key]: triggers },
        loadingDetails: { ...state.loadingDetails, [key]: false },
      }));
    } catch (err: any) {
      console.error(`Failed to fetch details for ${key}`, err);
      const errMsg = err.message || err.toString();
      set((state) => ({
        error: errMsg,
        loadingDetails: { ...state.loadingDetails, [key]: false },
      }));
      throw err;
    }
  },

  fetchFunctions: async (connId, schema) => {
    try {
      const functions = await invoke<Function[]>('get_functions', { connId, schema });
      set((state) => ({
        functions: { ...state.functions, [schema]: functions },
      }));
    } catch (err: any) {
      console.error(`Failed to fetch functions for schema ${schema}`, err);
    }
  },

  fetchSequences: async (connId, schema) => {
    try {
      const sequences = await invoke<Sequence[]>('get_sequences', { connId, schema });
      set((state) => ({
        sequences: { ...state.sequences, [schema]: sequences },
      }));
    } catch (err: any) {
      console.error(`Failed to fetch sequences for schema ${schema}`, err);
    }
  },

  fetchExtensions: async (connId) => {
    try {
      const extensions = await invoke<Extension[]>('get_extensions', { connId });
      set({ extensions });
    } catch (err: any) {
      console.error('Failed to fetch extensions', err);
    }
  },

  clearSchemaCache: () => {
    set({
      databases: [],
      schemas: [],
      tables: {},
      columns: {},
      indexes: {},
      constraints: {},
      triggers: {},
      functions: {},
      sequences: {},
      extensions: [],
      error: null,
    });
  },
}));
