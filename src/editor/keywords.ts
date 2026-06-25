import type { languages } from 'monaco-editor';

export type CompletionKind = languages.CompletionItemKind;

const KW = 1 as languages.CompletionItemKind.Keyword;
const FN = 2 as languages.CompletionItemKind.Function;
const TY = 13 as languages.CompletionItemKind.TypeParameter;

export interface KeywordEntry {
  label: string;
  kind: languages.CompletionItemKind;
  detail: string;
  insertText?: string;
  docs?: string;
}

export const SQL_KEYWORDS: KeywordEntry[] = [
  // DML
  { label: 'SELECT', kind: KW, detail: 'Retrieve rows from a table', docs: 'SELECT [DISTINCT] column1, column2, ... FROM table_name' },
  { label: 'INSERT', kind: KW, detail: 'Insert rows into a table', insertText: 'INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values})' },
  { label: 'UPDATE', kind: KW, detail: 'Update rows in a table', insertText: 'UPDATE ${1:table} SET ${2:column} = ${3:value} WHERE ${4:condition}' },
  { label: 'DELETE', kind: KW, detail: 'Delete rows from a table', insertText: 'DELETE FROM ${1:table} WHERE ${2:condition}' },
  { label: 'MERGE', kind: KW, detail: 'Conditionally insert/update/delete rows' },
  { label: 'RETURNING', kind: KW, detail: 'Return values from modified rows' },

  // DDL
  { label: 'CREATE', kind: KW, detail: 'Create a database object' },
  { label: 'ALTER', kind: KW, detail: 'Modify a database object' },
  { label: 'DROP', kind: KW, detail: 'Remove a database object' },
  { label: 'TRUNCATE', kind: KW, detail: 'Remove all rows from a table quickly' },
  { label: 'RENAME', kind: KW, detail: 'Rename a database object' },
  { label: 'COMMENT', kind: KW, detail: 'Add a comment to a database object' },

  // DCL
  { label: 'GRANT', kind: KW, detail: 'Grant privileges' },
  { label: 'REVOKE', kind: KW, detail: 'Revoke privileges' },

  // TCL
  { label: 'BEGIN', kind: KW, detail: 'Start a transaction' },
  { label: 'COMMIT', kind: KW, detail: 'Commit the current transaction' },
  { label: 'ROLLBACK', kind: KW, detail: 'Roll back the current transaction' },
  { label: 'SAVEPOINT', kind: KW, detail: 'Set a savepoint within a transaction' },

  // Clauses
  { label: 'FROM', kind: KW, detail: 'Specify the source table(s)' },
  { label: 'WHERE', kind: KW, detail: 'Filter rows based on conditions' },
  { label: 'AND', kind: KW, detail: 'Combine conditions (both must be true)' },
  { label: 'OR', kind: KW, detail: 'Combine conditions (at least one must be true)' },
  { label: 'NOT', kind: KW, detail: 'Negate a condition' },
  { label: 'IN', kind: KW, detail: 'Check membership in a set or subquery' },
  { label: 'EXISTS', kind: KW, detail: 'Check if a subquery returns any rows' },
  { label: 'BETWEEN', kind: KW, detail: 'Check if value is within a range' },
  { label: 'LIKE', kind: KW, detail: 'Pattern matching with % and _' },
  { label: 'ILIKE', kind: KW, detail: 'Case-insensitive LIKE' },
  { label: 'IS', kind: KW, detail: 'Check for NULL, TRUE, FALSE, etc.' },
  { label: 'NULL', kind: KW, detail: 'Represents an unknown or missing value' },
  { label: 'TRUE', kind: KW, detail: 'Boolean true' },
  { label: 'FALSE', kind: KW, detail: 'Boolean false' },

  // Joins
  { label: 'JOIN', kind: KW, detail: 'Combine rows from two tables' },
  { label: 'INNER JOIN', kind: KW, detail: 'Return rows matching in both tables' },
  { label: 'LEFT JOIN', kind: KW, detail: 'Return all rows from left table, matched rows from right' },
  { label: 'RIGHT JOIN', kind: KW, detail: 'Return all rows from right table, matched rows from left' },
  { label: 'FULL JOIN', kind: KW, detail: 'Return all rows from both tables' },
  { label: 'FULL OUTER JOIN', kind: KW, detail: 'Return all rows from both tables' },
  { label: 'CROSS JOIN', kind: KW, detail: 'Cartesian product of both tables' },
  { label: 'NATURAL JOIN', kind: KW, detail: 'Join on columns with the same name' },
  { label: 'ON', kind: KW, detail: 'Specify join condition' },
  { label: 'USING', kind: KW, detail: 'Specify join columns when names match' },
  { label: 'LATERAL', kind: KW, detail: 'Allow subqueries in FROM to reference preceding items' },

  // Aggregation
  { label: 'GROUP BY', kind: KW, detail: 'Group rows sharing a common value' },
  { label: 'HAVING', kind: KW, detail: 'Filter groups after aggregation' },
  { label: 'ORDER BY', kind: KW, detail: 'Sort result rows' },
  { label: 'ASC', kind: KW, detail: 'Ascending sort order' },
  { label: 'DESC', kind: KW, detail: 'Descending sort order' },
  { label: 'NULLS FIRST', kind: KW, detail: 'Place NULL values first in sort' },
  { label: 'NULLS LAST', kind: KW, detail: 'Place NULL values last in sort' },
  { label: 'LIMIT', kind: KW, detail: 'Limit the number of returned rows' },
  { label: 'OFFSET', kind: KW, detail: 'Skip rows before starting to return rows' },
  { label: 'FETCH', kind: KW, detail: 'Retrieve rows using SQL standard syntax' },
  { label: 'DISTINCT', kind: KW, detail: 'Remove duplicate rows from results' },
  { label: 'DISTINCT ON', kind: KW, detail: 'Keep the first row for each distinct expression' },

  // Subqueries / CTEs
  { label: 'WITH', kind: KW, detail: 'Define a Common Table Expression (CTE)' },
  { label: 'AS', kind: KW, detail: 'Alias a column, table, or subquery' },
  { label: 'UNION', kind: KW, detail: 'Combine results of two queries (distinct)' },
  { label: 'UNION ALL', kind: KW, detail: 'Combine results of two queries (all rows)' },
  { label: 'INTERSECT', kind: KW, detail: 'Return rows common to both queries' },
  { label: 'EXCEPT', kind: KW, detail: 'Return rows from first query not in second' },

  // Window Functions
  { label: 'OVER', kind: KW, detail: 'Define a window for window functions' },
  { label: 'PARTITION BY', kind: KW, detail: 'Partition window function results' },
  { label: 'ROWS', kind: KW, detail: 'Define window frame in rows' },
  { label: 'RANGE', kind: KW, detail: 'Define window frame in value ranges' },

  // Set operations / misc
  { label: 'CASE', kind: KW, detail: 'Conditional expression', insertText: 'CASE WHEN ${1:condition} THEN ${2:result} ELSE ${3:default} END' },
  { label: 'WHEN', kind: KW, detail: 'Branch of a CASE expression' },
  { label: 'THEN', kind: KW, detail: 'Result value of a CASE branch' },
  { label: 'ELSE', kind: KW, detail: 'Default result of a CASE expression' },
  { label: 'END', kind: KW, detail: 'End a CASE or block' },
  { label: 'COALESCE', kind: FN, detail: 'Return the first non-null argument' },
  { label: 'NULLIF', kind: FN, detail: 'Return NULL if arguments are equal' },
  { label: 'CAST', kind: KW, detail: 'Convert a value to a different type', insertText: 'CAST(${1:expression} AS ${2:type})' },

  // Indexes / constraints
  { label: 'INDEX', kind: KW, detail: 'Create an index' },
  { label: 'UNIQUE', kind: KW, detail: 'Ensure unique values in a column or set of columns' },
  { label: 'PRIMARY KEY', kind: KW, detail: 'Define the primary key for a table' },
  { label: 'FOREIGN KEY', kind: KW, detail: 'Define a foreign key relationship' },
  { label: 'REFERENCES', kind: KW, detail: 'Specify a referenced table for a foreign key' },
  { label: 'CHECK', kind: KW, detail: 'Add a check constraint' },
  { label: 'DEFAULT', kind: KW, detail: 'Set a default value for a column' },
  { label: 'CONSTRAINT', kind: KW, detail: 'Name a constraint' },
  { label: 'CASCADE', kind: KW, detail: 'Propagate changes to related rows' },
  { label: 'SET NULL', kind: KW, detail: 'Set referencing column to NULL on delete/update' },
  { label: 'SET DEFAULT', kind: KW, detail: 'Set referencing column to default on delete/update' },

  // Schema management
  { label: 'SCHEMA', kind: KW, detail: 'A database schema (namespace)' },
  { label: 'TABLE', kind: KW, detail: 'Create or reference a table' },
  { label: 'VIEW', kind: KW, detail: 'Create or reference a view' },
  { label: 'MATERIALIZED VIEW', kind: KW, detail: 'Create a materialized view' },
  { label: 'SEQUENCE', kind: KW, detail: 'Create or reference a sequence' },
  { label: 'FUNCTION', kind: KW, detail: 'Create or reference a function' },
  { label: 'TRIGGER', kind: KW, detail: 'Create or reference a trigger' },
  { label: 'PROCEDURE', kind: KW, detail: 'Create or reference a procedure' },
  { label: 'EXTENSION', kind: KW, detail: 'Create or manage an extension' },
  { label: 'DATABASE', kind: KW, detail: 'Create or manage a database' },
  { label: 'TABLESPACE', kind: KW, detail: 'Create or manage a tablespace' },
  { label: 'ROLE', kind: KW, detail: 'Create or manage a role' },
  { label: 'USER', kind: KW, detail: 'Create or manage a user' },

  // Types
  { label: 'INTEGER', kind: TY, detail: '4-byte signed integer' },
  { label: 'INT', kind: TY, detail: 'Alias for INTEGER' },
  { label: 'BIGINT', kind: TY, detail: '8-byte signed integer' },
  { label: 'SMALLINT', kind: TY, detail: '2-byte signed integer' },
  { label: 'SERIAL', kind: TY, detail: 'Auto-incrementing 4-byte integer' },
  { label: 'BIGSERIAL', kind: TY, detail: 'Auto-incrementing 8-byte integer' },
  { label: 'SMALLSERIAL', kind: TY, detail: 'Auto-incrementing 2-byte integer' },
  { label: 'BOOLEAN', kind: TY, detail: 'True/False value' },
  { label: 'BOOL', kind: TY, detail: 'Alias for BOOLEAN' },
  { label: 'TEXT', kind: TY, detail: 'Variable-length text, unlimited' },
  { label: 'VARCHAR', kind: TY, detail: 'Variable-length text with limit', insertText: 'VARCHAR(${1:255})' },
  { label: 'CHAR', kind: TY, detail: 'Fixed-length character string' },
  { label: 'NUMERIC', kind: TY, detail: 'Exact numeric of selectable precision', insertText: 'NUMERIC(${1:precision}, ${2:scale})' },
  { label: 'DECIMAL', kind: TY, detail: 'Alias for NUMERIC' },
  { label: 'REAL', kind: TY, detail: '4-byte floating-point' },
  { label: 'FLOAT4', kind: TY, detail: 'Alias for REAL' },
  { label: 'DOUBLE PRECISION', kind: TY, detail: '8-byte floating-point' },
  { label: 'FLOAT8', kind: TY, detail: 'Alias for DOUBLE PRECISION' },
  { label: 'DATE', kind: TY, detail: 'Calendar date (year, month, day)' },
  { label: 'TIME', kind: TY, detail: 'Time of day' },
  { label: 'TIMESTAMP', kind: TY, detail: 'Date and time' },
  { label: 'TIMESTAMPTZ', kind: TY, detail: 'Date and time with time zone' },
  { label: 'INTERVAL', kind: TY, detail: 'Time interval' },
  { label: 'UUID', kind: TY, detail: 'Universally Unique Identifier' },
  { label: 'JSON', kind: TY, detail: 'JSON data (text storage, validates on input)' },
  { label: 'JSONB', kind: TY, detail: 'JSON data (binary storage, supports indexing)' },
  { label: 'BYTEA', kind: TY, detail: 'Binary data (byte array)' },
  { label: 'ARRAY', kind: TY, detail: 'Array of any data type' },
  { label: 'INET', kind: TY, detail: 'IPv4 or IPv6 network address' },
  { label: 'CIDR', kind: TY, detail: 'IPv4 or IPv6 network specification' },
  { label: 'MACADDR', kind: TY, detail: 'MAC (Media Access Control) address' },

  // Explanation
  { label: 'EXPLAIN', kind: KW, detail: 'Show the execution plan of a query' },
  { label: 'ANALYZE', kind: KW, detail: 'Execute the query and show actual run statistics' },
  { label: 'VACUUM', kind: KW, detail: 'Garbage-collect and optionally analyze a database' },
  { label: 'REINDEX', kind: KW, detail: 'Rebuild indexes' },
  { label: 'CLUSTER', kind: KW, detail: 'Reorder a table physically based on an index' },
  { label: 'REFRESH', kind: KW, detail: 'Refresh a materialized view' },
  { label: 'LISTEN', kind: KW, detail: 'Listen for a notification' },
  { label: 'NOTIFY', kind: KW, detail: 'Send a notification' },
  { label: 'COPY', kind: KW, detail: 'Copy data between a table and a file' },
  { label: 'LOCK', kind: KW, detail: 'Lock a table explicitly' },
  { label: 'PREPARE', kind: KW, detail: 'Prepare a statement for execution' },
  { label: 'EXECUTE', kind: KW, detail: 'Execute a prepared statement' },
  { label: 'DEALLOCATE', kind: KW, detail: 'Deallocate a prepared statement' },
];

export const SQL_FUNCTIONS: KeywordEntry[] = [
  // Aggregate
  { label: 'COUNT', kind: FN, detail: 'Count rows or non-null values', insertText: 'COUNT(${1:*})' },
  { label: 'SUM', kind: FN, detail: 'Sum of values', insertText: 'SUM(${1:column})' },
  { label: 'AVG', kind: FN, detail: 'Average of values', insertText: 'AVG(${1:column})' },
  { label: 'MIN', kind: FN, detail: 'Minimum value', insertText: 'MIN(${1:column})' },
  { label: 'MAX', kind: FN, detail: 'Maximum value', insertText: 'MAX(${1:column})' },
  { label: 'ARRAY_AGG', kind: FN, detail: 'Aggregate values into an array' },
  { label: 'STRING_AGG', kind: FN, detail: 'Aggregate strings with a delimiter' },
  { label: 'JSON_AGG', kind: FN, detail: 'Aggregate rows into a JSON array' },
  { label: 'JSONB_AGG', kind: FN, detail: 'Aggregate rows into a JSONB array' },
  { label: 'JSON_OBJECT_AGG', kind: FN, detail: 'Aggregate key-value pairs into a JSON object' },
  { label: 'JSONB_OBJECT_AGG', kind: FN, detail: 'Aggregate key-value pairs into a JSONB object' },
  { label: 'BOOL_AND', kind: FN, detail: 'True if all input values are true' },
  { label: 'BOOL_OR', kind: FN, detail: 'True if at least one input value is true' },
  { label: 'EVERY', kind: FN, detail: 'Equivalent to BOOL_AND' },

  // String
  { label: 'CONCAT', kind: FN, detail: 'Concatenate strings', insertText: 'CONCAT(${1:str1}, ${2:str2})' },
  { label: 'LENGTH', kind: FN, detail: 'Length of a string', insertText: 'LENGTH(${1:string})' },
  { label: 'LOWER', kind: FN, detail: 'Convert string to lowercase', insertText: 'LOWER(${1:string})' },
  { label: 'UPPER', kind: FN, detail: 'Convert string to uppercase', insertText: 'UPPER(${1:string})' },
  { label: 'TRIM', kind: FN, detail: 'Remove leading and trailing whitespace', insertText: 'TRIM(${1:string})' },
  { label: 'LTRIM', kind: FN, detail: 'Remove leading whitespace' },
  { label: 'RTRIM', kind: FN, detail: 'Remove trailing whitespace' },
  { label: 'SUBSTRING', kind: FN, detail: 'Extract a substring', insertText: 'SUBSTRING(${1:string} FROM ${2:start} FOR ${3:length})' },
  { label: 'REPLACE', kind: FN, detail: 'Replace occurrences of a substring', insertText: 'REPLACE(${1:string}, ${2:from}, ${3:to})' },
  { label: 'SPLIT_PART', kind: FN, detail: 'Split string on delimiter and return nth part' },
  { label: 'LEFT', kind: FN, detail: 'First n characters of a string' },
  { label: 'RIGHT', kind: FN, detail: 'Last n characters of a string' },
  { label: 'REGEXP_REPLACE', kind: FN, detail: 'Replace using regex pattern' },
  { label: 'REGEXP_MATCHES', kind: FN, detail: 'Return matches of a regex pattern' },
  { label: 'POSITION', kind: FN, detail: 'Find position of substring', insertText: 'POSITION(${1:substring} IN ${2:string})' },

  // Numeric
  { label: 'ABS', kind: FN, detail: 'Absolute value', insertText: 'ABS(${1:number})' },
  { label: 'ROUND', kind: FN, detail: 'Round to the nearest integer or specified decimal places' },
  { label: 'CEIL', kind: FN, detail: 'Round up to the nearest integer' },
  { label: 'FLOOR', kind: FN, detail: 'Round down to the nearest integer' },
  { label: 'TRUNC', kind: FN, detail: 'Truncate to the specified number of decimal places' },
  { label: 'MOD', kind: FN, detail: 'Modulo (remainder of division)' },
  { label: 'POWER', kind: FN, detail: 'Raise a number to an exponent' },
  { label: 'SQRT', kind: FN, detail: 'Square root' },
  { label: 'GREATEST', kind: FN, detail: 'Largest value among arguments' },
  { label: 'LEAST', kind: FN, detail: 'Smallest value among arguments' },
  { label: 'RANDOM', kind: FN, detail: 'Random value between 0.0 and 1.0', insertText: 'RANDOM()' },

  // Date/Time
  { label: 'NOW', kind: FN, detail: 'Current timestamp with time zone', insertText: 'NOW()' },
  { label: 'CURRENT_TIMESTAMP', kind: FN, detail: 'Current date and time', insertText: 'CURRENT_TIMESTAMP' },
  { label: 'CURRENT_DATE', kind: FN, detail: 'Current date', insertText: 'CURRENT_DATE' },
  { label: 'CURRENT_TIME', kind: FN, detail: 'Current time', insertText: 'CURRENT_TIME' },
  { label: 'EXTRACT', kind: FN, detail: 'Extract a field from a date/time', insertText: 'EXTRACT(${1:YEAR} FROM ${2:timestamp})' },
  { label: 'DATE_TRUNC', kind: FN, detail: 'Truncate a timestamp to a specified precision', insertText: "DATE_TRUNC('${1:day}', ${2:timestamp})" },
  { label: 'AGE', kind: FN, detail: 'Calculate time difference' },
  { label: 'DATE_PART', kind: FN, detail: 'Get a subfield from a date/time', insertText: "DATE_PART('${1:year}', ${2:timestamp})" },
  { label: 'TO_CHAR', kind: FN, detail: 'Format a timestamp to string' },
  { label: 'TO_DATE', kind: FN, detail: 'Parse a string to date' },
  { label: 'TO_TIMESTAMP', kind: FN, detail: 'Parse a string to timestamp' },
  { label: 'MAKE_DATE', kind: FN, detail: 'Create date from year, month, day' },
  { label: 'MAKE_TIME', kind: FN, detail: 'Create time from hour, minute, second' },
  { label: 'MAKE_TIMESTAMP', kind: FN, detail: 'Create timestamp from year, month, day, hour, minute, second' },
  { label: 'GENERATE_SERIES', kind: FN, detail: 'Generate a series of values (timestamps or numbers)' },

  // JSON
  { label: 'ROW_TO_JSON', kind: FN, detail: 'Convert a row to a JSON object' },
  { label: 'JSON_BUILD_OBJECT', kind: FN, detail: 'Build a JSON object from key-value pairs' },
  { label: 'JSON_BUILD_ARRAY', kind: FN, detail: 'Build a JSON array from values' },
  { label: 'JSON_EXTRACT_PATH', kind: FN, detail: 'Extract a value from a JSON path' },
  { label: 'JSONB_EXTRACT_PATH', kind: FN, detail: 'Extract a value from a JSONB path' },
  { label: 'JSONB_SET', kind: FN, detail: 'Set a JSONB value at a path' },
  { label: 'JSONB_INSERT', kind: FN, detail: 'Insert a JSONB value at a path' },
  { label: 'JSONB_PRETTY', kind: FN, detail: 'Pretty-print a JSONB value' },
  { label: 'JSONB_STRIP_NULLS', kind: FN, detail: 'Remove null fields from a JSONB object' },
  { label: 'TO_JSON', kind: FN, detail: 'Convert a value to JSON' },
  { label: 'TO_JSONB', kind: FN, detail: 'Convert a value to JSONB' },

  // Conversion
  { label: 'CAST', kind: FN, detail: 'Convert a value to a specified type', insertText: 'CAST(${1:expression} AS ${2:type})' },
  { label: 'COALESCE', kind: FN, detail: 'Return the first non-null argument', insertText: 'COALESCE(${1:expr1}, ${2:expr2})' },
  { label: 'NULLIF', kind: FN, detail: 'Return null if two arguments are equal', insertText: 'NULLIF(${1:value1}, ${2:value2})' },
  { label: 'GREATEST', kind: FN, detail: 'Return the largest value from a list' },
  { label: 'LEAST', kind: FN, detail: 'Return the smallest value from a list' },

  // Array
  { label: 'ARRAY_LENGTH', kind: FN, detail: 'Length of an array dimension' },
  { label: 'UNNEST', kind: FN, detail: 'Expand an array into a set of rows', insertText: 'UNNEST(${1:array_column})' },
  { label: 'ARRAY_AGG', kind: FN, detail: 'Aggregate values into an array' },
  { label: 'ARRAY_TO_STRING', kind: FN, detail: 'Convert an array to a delimited string' },
  { label: 'STRING_TO_ARRAY', kind: FN, detail: 'Convert a delimited string to an array' },

  // Window
  { label: 'ROW_NUMBER', kind: FN, detail: 'Number of the current row within its partition', insertText: 'ROW_NUMBER() OVER (${1:ORDER BY column})' },
  { label: 'RANK', kind: FN, detail: 'Rank of the current row with gaps' },
  { label: 'DENSE_RANK', kind: FN, detail: 'Rank of the current row without gaps' },
  { label: 'NTILE', kind: FN, detail: 'Divide rows into n buckets' },
  { label: 'LAG', kind: FN, detail: 'Value from a previous row', insertText: 'LAG(${1:column}) OVER (${2:ORDER BY column})' },
  { label: 'LEAD', kind: FN, detail: 'Value from a following row', insertText: 'LEAD(${1:column}) OVER (${2:ORDER BY column})' },
  { label: 'FIRST_VALUE', kind: FN, detail: 'First value in the window frame' },
  { label: 'LAST_VALUE', kind: FN, detail: 'Last value in the window frame' },
  { label: 'NTH_VALUE', kind: FN, detail: 'Nth value in the window frame' },

  // System
  { label: 'PG_SLEEP', kind: FN, detail: 'Sleep for a specified number of seconds', insertText: 'PG_SLEEP(${1:seconds})' },
  { label: 'PG_BACKEND_PID', kind: FN, detail: 'Process ID of the server process for the current session' },
  { label: 'PG_CANCEL_BACKEND', kind: FN, detail: 'Cancel a query running in another backend' },
  { label: 'PG_TERMINATE_BACKEND', kind: FN, detail: 'Terminate a backend process' },
  { label: 'PG_SIZE_PRETTY', kind: FN, detail: 'Format a number of bytes in human-readable form' },
  { label: 'PG_TOTAL_RELATION_SIZE', kind: FN, detail: 'Total disk space used by a table' },
  { label: 'PG_RELATION_SIZE', kind: FN, detail: 'Disk space used by a table (main fork only)' },
  { label: 'PG_DATABASE_SIZE', kind: FN, detail: 'Disk space used by a database' },
  { label: 'PG_TABLE_SIZE', kind: FN, detail: 'Disk space used by a table excluding indexes' },
  { label: 'PG_INDEXES_SIZE', kind: FN, detail: 'Total disk space used by indexes on a table' },
  { label: 'CURRENT_USER', kind: FN, detail: 'Current user name' },
  { label: 'CURRENT_SCHEMA', kind: FN, detail: 'Current schema name' },
  { label: 'SESSION_USER', kind: FN, detail: 'Session user name' },
  { label: 'VERSION', kind: FN, detail: 'PostgreSQL version string', insertText: 'VERSION()' },
  { label: 'PG_COLUMN_SIZE', kind: FN, detail: 'Number of bytes used to store a particular value' },
  { label: 'GEN_RANDOM_UUID', kind: FN, detail: 'Generate a random UUID v4' },
  { label: 'MD5', kind: FN, detail: 'Calculate MD5 hash' },
  { label: 'SHA256', kind: FN, detail: 'Calculate SHA-256 hash' },

  // Full-text search
  { label: 'TO_TSVECTOR', kind: FN, detail: 'Convert text to a tsvector for full-text search' },
  { label: 'TO_TSQUERY', kind: FN, detail: 'Convert text to a tsquery for full-text search' },
  { label: 'PLAINTO_TSQUERY', kind: FN, detail: 'Convert plain text to a tsquery' },
  { label: 'TS_RANK', kind: FN, detail: 'Rank a tsvector against a tsquery' },
];
