import { appConfig } from "./config";
import type { RowDataPacket } from "mysql2";
import { getDataSourceColumns, resolveDataSourceTable } from "./dataSource";
import { getMySqlPool, quoteMySqlIdentifier } from "./mysql";
import type { ColumnFilter, SortDirection, TableDataResponse } from "../shared/types";

const textTypes = new Set(["char", "varchar", "tinytext", "text", "mediumtext", "longtext", "enum", "set"]);
type CountRow = RowDataPacket & { row_count: number | string };

const parseFilters = (filtersJson?: string): ColumnFilter[] => {
  if (!filtersJson) return [];
  const parsed = JSON.parse(filtersJson) as ColumnFilter[];
  return Array.isArray(parsed) ? parsed : [];
};

const buildWhere = (allowedColumns: Set<string>, textColumns: string[], search: string | undefined, filters: ColumnFilter[]) => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (search?.trim() && textColumns.length) {
    clauses.push(`(${textColumns.map((column) => `${quoteMySqlIdentifier(column)} LIKE ?`).join(" OR ")})`);
    values.push(...textColumns.map(() => `%${search.trim()}%`));
  }
  for (const filter of filters) {
    if (!allowedColumns.has(filter.column)) continue;
    const column = quoteMySqlIdentifier(filter.column);
    const value = filter.value ?? "";
    if (filter.operator === "isEmpty") {
      clauses.push(`(${column} IS NULL OR CAST(${column} AS CHAR) = '')`);
      continue;
    }
    if (filter.operator === "contains" || filter.operator === "startsWith" || filter.operator === "equals") {
      const suffix = filter.operator === "contains" ? `%${value}%` : filter.operator === "startsWith" ? `${value}%` : value;
      clauses.push(`CAST(${column} AS CHAR) ${filter.operator === "equals" ? "=" : "LIKE"} ?`);
      values.push(suffix);
      continue;
    }
    const operators: Partial<Record<ColumnFilter["operator"], string>> = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
    const operator = operators[filter.operator];
    if (operator) {
      clauses.push(`${column} ${operator} ?`);
      values.push(value);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
};

export const getMySqlTableData = async (params: {
  database: string; schema?: string; table: string; page: number; pageSize: number; search?: string;
  sortColumn?: string; sortDirection?: SortDirection; filtersJson?: string;
}): Promise<TableDataResponse> => {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), appConfig.maxPageSize);
  const table = await resolveDataSourceTable(params.database, params.table, params.schema);
  const columns = await getDataSourceColumns(params.database, table.schema, table.name);
  if (!columns.length) throw new Error("Table has no readable columns.");
  const allowedColumns = new Set(columns.map((column) => column.name));
  const textColumns = columns.filter((column) => textTypes.has(column.dataType.toLowerCase())).map((column) => column.name);
  const sortColumn = params.sortColumn && allowedColumns.has(params.sortColumn) ? params.sortColumn : columns[0].name;
  const filters = parseFilters(params.filtersJson);
  const where = buildWhere(allowedColumns, textColumns, params.search, filters);
  const tableRef = `${quoteMySqlIdentifier(params.database)}.${quoteMySqlIdentifier(table.name)}`;
  const pool = getMySqlPool();
  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS row_count FROM ${tableRef} ${where.sql}`,
    where.values
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${columns.map((column) => quoteMySqlIdentifier(column.name)).join(", ")}
     FROM ${tableRef} ${where.sql}
     ORDER BY ${quoteMySqlIdentifier(sortColumn)} ${params.sortDirection === "desc" ? "DESC" : "ASC"}
     LIMIT ? OFFSET ?`,
    [...where.values, pageSize, (page - 1) * pageSize]
  );
  return {
    database: params.database,
    table: table.name,
    tableDescription: table.description,
    columns,
    rows: rows as Record<string, unknown>[],
    rowCount: Number(countRows[0]?.row_count ?? 0),
    page,
    pageSize
  };
};
