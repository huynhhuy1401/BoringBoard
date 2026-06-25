import type { languages, Position, editor } from 'monaco-editor';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from './keywords';
import { getSchemaCache, type SchemaCache } from './schemaProvider';

type CItem = languages.CompletionItem;

// Use numeric literals cast to the enum type for CompletionItemKind
// These are used by the helper functions below
const _CLASS = 7 as languages.CompletionItemKind;
const _FIELD = 5 as languages.CompletionItemKind;
const _MODULE = 9 as languages.CompletionItemKind;
const _FUNC = 2 as languages.CompletionItemKind;

/**
 * Detect the SQL context at the cursor position to decide what to suggest.
 */
interface CompletionContext {
  type: 'keyword' | 'schema' | 'table' | 'column' | 'column_of_table' | 'function';
  tableOrAlias?: string;
  prefix: string;
}

function detectContext(
  model: editor.ITextModel,
  position: Position,
): CompletionContext {
  const textUntil = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });

  // What user is currently typing
  const word = model.getWordUntilPosition(position);
  const currentWord = word.word || '';

  // Clean up text for easier matching (collapse whitespace, uppercase for keywords)
  const upperText = textUntil.toUpperCase().trim();

  // Check for schema. pattern (e.g. "public.")
  const schemaDotMatch = textUntil.match(/(\w+)\.\s*(\w*)$/);
  if (schemaDotMatch && !upperText.match(/(FROM|JOIN|INTO|UPDATE|TABLE|SET)\s+\w+\.\w*$/i)) {
    // Check if the word before dot is a known schema
    const cache = getSchemaCache();
    const prefix = schemaDotMatch[1];
    if (cache.schemas.includes(prefix)) {
      // "schema." — suggest tables in that schema
      return { type: 'table', tableOrAlias: prefix, prefix: currentWord };
    }
    // "table_alias." — suggest columns from that table
    return { type: 'column_of_table', tableOrAlias: prefix, prefix: currentWord };
  }

  // Check for FROM/JOIN/UPDATE/INTO context (suggest tables/schemas)
  if (upperText.match(/(?:FROM|JOIN|UPDATE\s+\w+\s+SET|INTO)\s*$/i) ||
      upperText.match(/(?:FROM|JOIN|UPDATE|INTO)\s+[\w.]*\s*,\s*[\w.]*$/i)) {
    return { type: 'table', prefix: currentWord };
  }

  // Check for table reference after FROM/JOIN keyword (partial table name typed)
  if (upperText.match(/(?:FROM|JOIN)\s+\w*$/i) ||
      upperText.match(/(?:FROM|JOIN)\s+[\w.]+\s*,\s*\w*$/i)) {
    return { type: 'table', prefix: currentWord };
  }

  // Check for ON context (columns)
  if (upperText.match(/\bON\s+\w*$/i) || upperText.match(/\bON\s+\w+\.\w*$/i)) {
    // Detect table aliases from preceding JOIN for better suggestions
    const joinMatch = textUntil.match(/(?:JOIN)\s+[\w.]+(?:\s+AS)?\s+(\w+)\s+ON\s+\w*$/i);
    if (joinMatch) {
      return { type: 'column_of_table', tableOrAlias: joinMatch[1], prefix: currentWord };
    }
    return { type: 'column', prefix: currentWord };
  }

  // Check for WHERE/AND/OR context (columns)
  if (upperText.match(/(?:WHERE|AND|OR|HAVING)\s+\w*$/i) ||
      upperText.match(/(?:WHERE|AND|OR|HAVING)\s+\w+\.\w*$/i)) {
    return { type: 'column', prefix: currentWord };
  }

  // Check for SET context (columns)
  if (upperText.match(/\bSET\s+\w*$/i) || upperText.match(/\bSET\s+\w+\.\w*$/i)) {
    return { type: 'column', prefix: currentWord };
  }

  // Check for SELECT / ORDER BY / GROUP BY context
  if (upperText.match(/(?:SELECT|ORDER\s+BY|GROUP\s+BY)\s+[\w.]*\s*,\s*\w*$/i) ||
      upperText.match(/(?:SELECT|ORDER\s+BY|GROUP\s+BY)\s+\w*$/i)) {
    return { type: 'column', prefix: currentWord };
  }

  // Check for RETURNING context
  if (upperText.match(/\bRETURNING\s+\w*$/i)) {
    return { type: 'column', prefix: currentWord };
  }

  // Default: suggest everything (keywords, functions, tables)
  return { type: 'keyword', prefix: currentWord };
}

function findTablesMatching(cache: SchemaCache, prefix: string, specificSchema?: string) {
  const lower = prefix.toLowerCase();
  const tables = specificSchema
    ? cache.allTables.filter((t) => t.schema === specificSchema)
    : cache.allTables;
  return tables
    .filter((t) => t.name.toLowerCase().startsWith(lower))
    .slice(0, 30);
}

function makeTableCompletions(tables: ReturnType<typeof findTablesMatching>, excludeSchema = false): CItem[] {
  return tables.map((t) => {
    const displayName = t.schema === 'public' ? t.name : `${t.schema}.${t.name}`;
    return {
      label: t.name,
      kind: _CLASS,
      detail: `${displayName} (${t.columns.length} cols${t.isView ? ', view' : ''})`,
      insertText: excludeSchema ? t.name : (t.schema === 'public' ? t.name : `${t.schema}.${t.name}`),
      sortText: `0_${t.name}`,
      range: undefined as any, // filled by Monaco
    };
  });
}

function makeColumnCompletions(
  cache: SchemaCache,
  prefix: string,
  tableOrAlias?: string,
) {
  const lower = prefix.toLowerCase();
  
  // Find which table we are referring to
  let targetTables = cache.allTables;
  if (tableOrAlias) {
    const tLower = tableOrAlias.toLowerCase();
    targetTables = cache.allTables.filter(
      (t) => t.name.toLowerCase() === tLower || t.schema.toLowerCase() === tLower
    );
  }

  const columns: { col: typeof targetTables[0]['columns'][0]; tableName: string; schema: string }[] = [];
  for (const t of targetTables) {
    for (const c of t.columns) {
      if (c.name.toLowerCase().startsWith(lower)) {
        columns.push({ col: c, tableName: t.name, schema: t.schema });
      }
    }
  }

  return columns.slice(0, 40).map(({ col, tableName, schema }) => ({
    label: col.name,
    kind: _FIELD,
    detail: `${col.dataType} (from ${schema === 'public' ? tableName : `${schema}.${tableName}`})`,
    insertText: col.name,
    sortText: col.isPrimaryKey ? `0_${col.name}` : `1_${col.name}`,
    range: undefined as any,
  }));
}

function makeSchemaCompletions(cache: SchemaCache): CItem[] {
  return cache.schemas.map((s) => ({
    label: s,
    kind: _MODULE,
    detail: `Schema`,
    insertText: s,
    sortText: `1_${s}`,
    range: undefined as any,
  }));
}

function makeFunctionCompletions(cache: SchemaCache, prefix: string): CItem[] {
  const lower = prefix.toLowerCase();
  return cache.allFunctions
    .filter((f) => f.name.toLowerCase().startsWith(lower))
    .slice(0, 20)
    .map((f) => ({
      label: f.name,
      kind: _FUNC,
      detail: `${f.schema}.${f.name}(${f.args}) → ${f.returnType}`,
      insertText: f.name,
      sortText: `2_${f.name}`,
      range: undefined as any,
    }));
}

/**
 * Create a Monaco CompletionItemProvider that provides schema-aware
 * autocompletions by reading the Zustand schemaStore.
 */
export function createSchemaCompletionProvider(): languages.CompletionItemProvider {
  return {
    triggerCharacters: ['.', ' ', ',', '('],
    provideCompletionItems: (model, position) => {
      const ctx = detectContext(model, position);
      const cache = getSchemaCache();

      const suggestions: CItem[] = [];

      switch (ctx.type) {
        case 'table':
          if (ctx.tableOrAlias) {
            // User typed a schema prefix followed by a dot, e.g. "auth."
            // Suggest only tables under this specific schema, and exclude schema prefix from insertText
            suggestions.push(...makeTableCompletions(
              findTablesMatching(cache, ctx.prefix, ctx.tableOrAlias),
              true
            ));
          } else {
            // Suggest schemas first (for schema.table pattern), then tables
            suggestions.push(...makeSchemaCompletions(cache));
            suggestions.push(...makeTableCompletions(findTablesMatching(cache, ctx.prefix)));
          }
          break;

        case 'column':
          suggestions.push(...makeColumnCompletions(cache, ctx.prefix));
          break;

        case 'column_of_table':
          suggestions.push(...makeColumnCompletions(cache, ctx.prefix, ctx.tableOrAlias));
          break;

        case 'keyword':
        default:
          // In free-text position: suggest keywords, functions, tables, columns
          suggestions.push(
            ...SQL_KEYWORDS.filter((k) =>
              k.label.toLowerCase().startsWith(ctx.prefix.toLowerCase()),
            ).slice(0, 15).map((k) => ({
              label: k.label,
              kind: k.kind,
              detail: k.detail,
              insertText: k.insertText || k.label,
              documentation: k.docs,
              sortText: `3_${k.label}`,
              range: undefined as any,
            })),
          );
          suggestions.push(
            ...SQL_FUNCTIONS.filter((f) =>
              f.label.toLowerCase().startsWith(ctx.prefix.toLowerCase()),
            ).slice(0, 10).map((f) => ({
              label: f.label,
              kind: f.kind,
              detail: f.detail,
              insertText: f.insertText || f.label,
              documentation: f.docs,
              sortText: `4_${f.label}`,
              range: undefined as any,
            })),
          );
          suggestions.push(...makeTableCompletions(findTablesMatching(cache, ctx.prefix)));
          suggestions.push(...makeFunctionCompletions(cache, ctx.prefix));
          break;
      }

      return { suggestions };
    },
  };
}
