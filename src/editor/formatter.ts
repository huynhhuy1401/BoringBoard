const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'FULL JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
  'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ORDER BY', 'GROUP BY',
  'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'DISTINCT', 'DISTINCT ON', 'UNION',
  'UNION ALL', 'INTERSECT', 'EXCEPT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX',
  'DROP INDEX', 'CREATE VIEW', 'DROP VIEW', 'CREATE SCHEMA', 'DROP SCHEMA',
  'WITH', 'RECURSIVE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'RETURNING',
  'INTO', 'USING', 'LATERAL', 'WINDOW', 'PARTITION BY', 'ROWS', 'RANGE',
  'GROUPS', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT ROW', 'EXCLUDE',
  'TIES', 'NO OTHERS', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CHECK', 'DEFAULT', 'UNIQUE',
  'NOT NULL', 'CONSTRAINT', 'CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT',
  'GRANT', 'REVOKE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'TRUNCATE', 'RENAME', 'COMMENT', 'EXPLAIN', 'ANALYZE', 'VACUUM', 'REINDEX',
  'COPY', 'LOCK', 'PREPARE', 'EXECUTE', 'DEALLOCATE', 'OVER', 'OVERLAPS',
];

const MAJOR_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'FULL JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'INSERT INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
  'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW', 'CREATE SCHEMA',
  'DROP SCHEMA', 'WITH', 'RECURSIVE', 'RETURNING', 'WINDOW',
]);

const NEWLINE_BEFORE = new Set(['AND', 'OR']);



interface Token {
  type: 'keyword' | 'string' | 'dollar_string' | 'comment' | 'multiline_comment' | 'whitespace' | 'comma' | 'paren' | 'other';
  value: string;
  keyword?: string;
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let end = sql.indexOf('\n', i);
      if (end === -1) end = sql.length;
      tokens.push({ type: 'comment', value: sql.slice(i, end) });
      i = end;
      continue;
    }

    if (sql[i] === '/' && sql[i + 1] === '*') {
      let end = sql.indexOf('*/', i + 2);
      if (end === -1) end = sql.length;
      else end += 2;
      tokens.push({ type: 'multiline_comment', value: sql.slice(i, end) });
      i = end;
      continue;
    }

    if (sql[i] === '$' && sql[i + 1] !== '$') {
      const tagMatch = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        const endIdx = sql.indexOf(tag, i + tag.length);
        if (endIdx !== -1) {
          tokens.push({ type: 'dollar_string', value: sql.slice(i, endIdx + tag.length) });
          i = endIdx + tag.length;
          continue;
        }
      }
    }

    if (sql[i] === '$' && sql[i + 1] === '$') {
      const endIdx = sql.indexOf('$$', i + 2);
      if (endIdx !== -1) {
        tokens.push({ type: 'dollar_string', value: sql.slice(i, endIdx + 2) });
        i = endIdx + 2;
        continue;
      }
    }

    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
        } else if (sql[j] === "'") {
          j++;
          break;
        } else {
          j++;
        }
      }
      tokens.push({ type: 'string', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    if (/\s/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: 'whitespace', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    if (sql[i] === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    if (sql[i] === '(' || sql[i] === ')') {
      tokens.push({ type: 'paren', value: sql[i] });
      i++;
      continue;
    }

    let j = i;
    while (j < sql.length && !/[\s,()'"]/.test(sql[j]) && !(sql[j] === '-' && sql[j + 1] === '-') && !(sql[j] === '/' && sql[j + 1] === '*') && !(sql[j] === '$')) {
      j++;
    }
    if (j === i) {
      tokens.push({ type: 'other', value: sql[i] });
      i++;
      continue;
    }

    const word = sql.slice(i, j);
    const upper = word.toUpperCase();

    const matchedKeyword = KEYWORDS.find(kw => {
      const parts = kw.split(' ');
      if (parts.length === 1) return upper === kw;
      const candidate = sql.slice(i, i + kw.length).toUpperCase();
      if (candidate === kw && (i + kw.length >= sql.length || /[\s,()]/.test(sql[i + kw.length]))) {
        return true;
      }
      return false;
    });

    if (matchedKeyword) {
      const parts = matchedKeyword.split(' ');
      if (parts.length > 1) {
        tokens.push({ type: 'keyword', value: matchedKeyword, keyword: matchedKeyword });
        i += matchedKeyword.length;
        if (i < sql.length && /\s/.test(sql[i])) {
          let k = i;
          while (k < sql.length && /\s/.test(sql[k])) k++;
          tokens.push({ type: 'whitespace', value: sql.slice(i, k) });
          i = k;
        }
        continue;
      }
      tokens.push({ type: 'keyword', value: matchedKeyword, keyword: matchedKeyword });
      i += matchedKeyword.length;
      if (i < sql.length && /\s/.test(sql[i])) {
        let k = i;
        while (k < sql.length && /\s/.test(sql[k])) k++;
        tokens.push({ type: 'whitespace', value: sql.slice(i, k) });
        i = k;
      }
      continue;
    }

    tokens.push({ type: 'other', value: word });
    i += word.length;
    if (i < sql.length && /\s/.test(sql[i])) {
      let k = i;
      while (k < sql.length && /\s/.test(sql[k])) k++;
      tokens.push({ type: 'whitespace', value: sql.slice(i, k) });
      i = k;
    }
  }

  return tokens;
}

function findKeywordAtPosition(tokens: Token[], pos: number): string | null {
  for (let i = pos; i < tokens.length; i++) {
    if (tokens[i].type === 'whitespace' || tokens[i].type === 'comment' || tokens[i].type === 'multiline_comment') continue;
    if (tokens[i].type === 'keyword') return tokens[i].keyword!;
    return null;
  }
  return null;
}

export function formatSql(sql: string): string {
  if (!sql.trim()) return sql;

  const tokens = tokenize(sql);
  const result: string[] = [];
  let indent = 0;
  const indentStr = '  ';
  let needsNewline = false;
  let inSelectList = false;
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextNonWs = (): Token | null => {
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type !== 'whitespace') return tokens[j];
      }
      return null;
    };

    if (token.type === 'comment' || token.type === 'multiline_comment') {
      result.push(token.value);
      needsNewline = token.type === 'comment';
      continue;
    }

    if (token.type === 'string' || token.type === 'dollar_string') {
      result.push(token.value);
      continue;
    }

    if (token.type === 'whitespace') {
      if (needsNewline) {
        result.push('\n');
        result.push(indentStr.repeat(indent));
        needsNewline = false;
      } else {
        const next = nextNonWs();
        if (next && (next.type === 'comma' || next.type === 'paren' && next.value === ')')) continue;
        if (result.length > 0 && result[result.length - 1] !== '\n' && result[result.length - 1] !== indentStr.repeat(indent)) {
          result.push(' ');
        }
      }
      continue;
    }

    if (token.type === 'comma') {
      result.push(',');
      if (inSelectList) {
        needsNewline = true;
      }
      continue;
    }

    if (token.type === 'paren') {
      if (token.value === '(') {
        result.push('(');
        parenDepth++;
        const afterParen = findKeywordAtPosition(tokens, i + 1);
        if (afterParen === 'SELECT') {
          indent++;
          needsNewline = true;
          inSelectList = true;
        }
      } else {
        parenDepth--;
        if (parenDepth < 0) parenDepth = 0;
        const lastResultChar = result[result.length - 1];
        if (lastResultChar === '\n' || lastResultChar === indentStr.repeat(indent)) {
          if (indent > 0) indent--;
          result.push(indentStr.repeat(indent));
        }
        result.push(')');
        if (indent > 0 && result[result.length - 2] === indentStr.repeat(indent)) {
          // already handled
        }
      }
      continue;
    }

    if (token.type === 'keyword' && token.keyword) {
      const kw = token.keyword;

      if (kw === 'SELECT' && parenDepth === 0) {
        inSelectList = true;
      }

      if (kw === 'FROM' && inSelectList) {
        inSelectList = false;
        if (parenDepth === 0) {
          needsNewline = true;
        }
      }

      if (MAJOR_KEYWORDS.has(kw)) {
        if (kw === 'WITH' || kw === 'RECURSIVE') {
          result.push(kw);
          continue;
        }

        if (kw === 'VALUES') {
          needsNewline = true;
          result.push(kw);
          continue;
        }

        if (parenDepth > 0 && kw !== 'SELECT' && kw !== 'FROM') {
          result.push(kw);
          continue;
        }

        if (kw === 'SET' && result.length > 0) {
          const prev = result[result.length - 1];
          if (prev !== '\n' && !prev.endsWith('\n')) {
            needsNewline = true;
          }
        }

        result.push(kw);
        continue;
      }

      if (NEWLINE_BEFORE.has(kw)) {
        if (parenDepth === 0) {
          needsNewline = true;
        }
        result.push(kw);
        continue;
      }

      if (kw === 'ON') {
        result.push(kw);
        continue;
      }

      if (kw === 'CASE') {
        result.push(kw);
        indent++;
        needsNewline = true;
        continue;
      }

      if (kw === 'WHEN' || kw === 'ELSE') {
        if (kw === 'WHEN' && indent > 0 && result.length > 0) {
          const prev = result[result.length - 1];
          if (prev !== '\n' && !prev.endsWith('\n')) {
            needsNewline = true;
          }
        }
        if (kw === 'ELSE') {
          needsNewline = true;
        }
        result.push(kw);
        continue;
      }

      if (kw === 'END') {
        if (indent > 0) indent--;
        needsNewline = true;
        result.push(kw);
        continue;
      }

      if (kw === 'THEN') {
        result.push(kw);
        needsNewline = true;
        continue;
      }

      result.push(kw);
      continue;
    }

    result.push(token.value);
  }

  let formatted = result.join('');

  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

  formatted = formatted.replace(/\)\s*;/g, ');');

  return formatted.trim();
}
