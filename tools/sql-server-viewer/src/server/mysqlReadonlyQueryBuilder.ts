import { appConfig } from "./config";
import { resolveSorts, validateFilters } from "./queryOptions";
import type { RowDataPacket } from "mysql2";
import { getDataSourceColumns, resolveDataSourceTable } from "./dataSource";
import { getMySqlPool, quoteMySqlIdentifier } from "./mysql";
import type { ColumnFilter, SortDirection, TableDataResponse } from "../shared/types";

const textTypes = new Set(["char", "varchar", "tinytext", "text", "mediumtext", "longtext", "enum", "set"]);
type CountRow = RowDataPacket & { row_count: number | string };

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
  sortColumn?: string; sortDirection?: SortDirection; sortsJson?: string; filtersJson?: string;
}): Promise<TableDataResponse> => {
  let page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), appConfig.maxPageSize);
  const table = await resolveDataSourceTable(params.database, params.table, params.schema);
  const columns = await getDataSourceColumns(params.database, table.schema, table.name);
  if (!columns.length) throw new Error("Table has no readable columns.");
  const allowedColumns = new Set(columns.map((column) => column.name));
  const textColumns = columns.filter((column) => textTypes.has(column.dataType.toLowerCase())).map((column) => column.name);
  const sorts = resolveSorts(params, allowedColumns);
  const filters = validateFilters(params.filtersJson, allowedColumns);
  const where = buildWhere(allowedColumns, textColumns, params.search, filters);
  const tableRef = `${quoteMySqlIdentifier(params.database)}.${quoteMySqlIdentifier(table.name)}`;
  const pool = getMySqlPool();
  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS row_count FROM ${tableRef} ${where.sql}`,
    where.values
  );
  page = Math.min(page, Math.max(1, Math.ceil(Number(countRows[0]?.row_count ?? 0) / pageSize)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${columns.map((column) => quoteMySqlIdentifier(column.name)).join(", ")}
     FROM ${tableRef} ${where.sql}
     ORDER BY ${sorts.map((sort) => `${quoteMySqlIdentifier(sort.column)} ${sort.direction === "desc" ? "DESC" : "ASC"}`).join(", ")}
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
