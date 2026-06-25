export interface Database {
  name: string;
}

export interface Schema {
  name: string;
}

export interface Table {
  name: string;
  schema: string;
  is_view: boolean;
  is_materialized_view: boolean;
  is_partitioned: boolean;
  is_foreign: boolean;
  row_count_estimate?: number;
  comment?: string;
}

export interface Column {
  name: string;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  column_default?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_identity: boolean;
  is_generated: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  comment?: string;
}

export interface Index {
  name: string;
  table_name: string;
  is_unique: boolean;
  is_primary: boolean;
  definition: string;
}

export interface Constraint {
  name: string;
  constraint_type: string;
  definition: string;
}

export interface Trigger {
  name: string;
  definition: string;
}

export interface Function {
  name: string;
  schema: string;
  return_type: string;
  argument_types: string;
  language: string;
  definition: string;
}

export interface Sequence {
  name: string;
  data_type: string;
  last_value?: number;
}

export interface Extension {
  name: string;
  default_version: string;
  installed_version?: string;
  comment?: string;
}

export interface CreateColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  default?: string;
}
