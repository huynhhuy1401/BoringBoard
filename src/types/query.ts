export interface ColumnInfo {
  name: string;
  data_type: string;
  udt_name: string;
  oid?: number;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: any[][];
  affected_rows: number;
  execution_time_ms: number;
  total_count?: number;
}

export interface DataOptions {
  limit?: number;
  offset?: number;
  sort_column?: string;
  sort_direction?: 'ASC' | 'DESC';
  filter_column?: string;
  filter_value?: string;
  filter_operator?: string;
}

export interface ExplainResult {
  plan: any;
  execution_time_ms: number;
}
