import { appConfig } from "./config";
import { getColumns, resolveTable } from "./metadata";
import { getPool, quoteIdentifier, sql } from "./sqlServer";
import type { ColumnFilter, SortDirection, TableDataResponse } from "../shared/types";

const textTypes = new Set(["char", "nchar", "varchar", "nvarchar", "text", "ntext"]);

const parseFilters = (filtersJson?: string): ColumnFilter[] => {
  if (!filtersJson) {
    return [];
  }
  const parsed = JSON.parse(filtersJson) as ColumnFilter[];
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
};

const buildWhere = (
  allowedColumns: Set<string>,
  textColumns: string[],
  search: string | undefined,
  filters: ColumnFilter[],
  request: import("mssql").Request
) => {
  const clauses: string[] = [];
  let paramIndex = 0;

  if (search?.trim() && textColumns.length > 0) {
    const paramName = `search${paramIndex++}`;
    request.input(paramName, sql.NVarChar, `%${search.trim()}%`);
    clauses.push(
      `(${textColumns.map((column) => `${quoteIdentifier(column)} LIKE @${paramName}`).join(" OR ")})`
    );
  }

  for (const filter of filters) {
    if (!allowedColumns.has(filter.column)) {
      continue;
    }

    const column = quoteIdentifier(filter.column);

    if (filter.operator === "isEmpty") {
      clauses.push(`(${column} IS NULL OR TRY_CONVERT(nvarchar(max), ${column}) = N'')`);
      continue;
    }

    const paramName = `filter${paramIndex++}`;
    const rawValue = filter.value ?? "";

    switch (filter.operator) {
      case "contains":
        request.input(paramName, sql.NVarChar, `%${rawValue}%`);
        clauses.push(`TRY_CONVERT(nvarchar(max), ${column}) LIKE @${paramName}`);
        break;
      case "startsWith":
        request.input(paramName, sql.NVarChar, `${rawValue}%`);
        clauses.push(`TRY_CONVERT(nvarchar(max), ${column}) LIKE @${paramName}`);
        break;
      case "equals":
        request.input(paramName, sql.NVarChar, rawValue);
        clauses.push(`TRY_CONVERT(nvarchar(max), ${column}) = @${paramName}`);
        break;
      case "gt":
        request.input(paramName, sql.NVarChar, rawValue);
        clauses.push(`${column} > @${paramName}`);
        break;
      case "gte":
        request.input(paramName, sql.NVarChar, rawValue);
        clauses.push(`${column} >= @${paramName}`);
        break;
      case "lt":
        request.input(paramName, sql.NVarChar, rawValue);
        clauses.push(`${column} < @${paramName}`);
        break;
      case "lte":
        request.input(paramName, sql.NVarChar, rawValue);
        clauses.push(`${column} <= @${paramName}`);
        break;
      default:
        break;
    }
  }

  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
};

export const getTableData = async (params: {
  database: string;
  schema?: string;
  table: string;
  page: number;
  pageSize: number;
  search?: string;
  sortColumn?: string;
  sortDirection?: SortDirection;
  filtersJson?: string;
}): Promise<TableDataResponse> => {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), appConfig.maxPageSize);
  const table = await resolveTable(params.database, params.table, params.schema);
  const columns = await getColumns(params.database, table.schema, table.name);
  const allowedColumns = new Set(columns.map((column) => column.name));
  const textColumns = columns
    .filter((column) => textTypes.has(column.dataType.toLowerCase()))
    .map((column) => column.name);

  const sortColumn = params.sortColumn && allowedColumns.has(params.sortColumn) ? params.sortColumn : columns[0]?.name;
  const sortDirection = params.sortDirection === "desc" ? "DESC" : "ASC";
  const filters = parseFilters(params.filtersJson);
  const pool = await getPool(params.database);
  const tableRef = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`;
  const offset = (page - 1) * pageSize;

  const countRequest = pool.request();
  const countWhere = buildWhere(allowedColumns, textColumns, params.search, filters, countRequest);
  const countResult = await countRequest.query<{ row_count: number }>(`
    SELECT COUNT_BIG(1) AS row_count
    FROM ${tableRef}
    ${countWhere}
  `);

  const dataRequest = pool.request();
  const dataWhere = buildWhere(allowedColumns, textColumns, params.search, filters, dataRequest);
  dataRequest.input("offset", sql.Int, offset);
  dataRequest.input("pageSize", sql.Int, pageSize);

  const dataResult = await dataRequest.query<Record<string, unknown>>(`
    SELECT ${columns.map((column) => quoteIdentifier(column.name)).join(", ")}
    FROM ${tableRef}
    ${dataWhere}
    ORDER BY ${quoteIdentifier(sortColumn ?? columns[0].name)} ${sortDirection}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return {
    database: params.database,
    table: table.name,
    tableDescription: table.description,
    columns,
    rows: dataResult.recordset,
    rowCount: Number(countResult.recordset[0]?.row_count ?? 0),
    page,
    pageSize
  };
};
