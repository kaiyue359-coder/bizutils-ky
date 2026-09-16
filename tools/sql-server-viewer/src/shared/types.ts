export type TextNote = {
  name: string;
  description: string | null;
};

export type DatabaseNode = TextNote & {
  tableCount: number;
  rowCountLabel?: string;
  tables: TableNode[];
};

export type TableNode = TextNote & {
  database: string;
  schema: string;
  rowCount: number | null;
  rowCountLabel: string | null;
};

export type ColumnMeta = TextNote & {
  dataType: string;
  isNullable: boolean;
  ordinal: number;
};

export type SortDirection = "asc" | "desc";

export type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty";

export type ColumnFilter = {
  column: string;
  operator: FilterOperator;
  value?: string;
};

export type TableDataResponse = {
  database: string;
  table: string;
  tableDescription: string | null;
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  rowCount: number;
  page: number;
  pageSize: number;
};
