import { appConfig } from "./config";
import { getPool, sql } from "./sqlServer";
import type { ColumnMeta, DatabaseNode, TableNode } from "../shared/types";

const systemDatabases = new Set(["master", "model", "msdb", "tempdb"]);

const isAllowedDatabase = (name: string) =>
  appConfig.databaseAllowlist.length === 0 || appConfig.databaseAllowlist.includes(name);

const isAllowedTable = (database: string, schema: string, table: string) => {
  if (appConfig.tableAllowlist.length === 0) {
    return true;
  }
  const keys = [`${database}.${schema}.${table}`, `${schema}.${table}`, table];
  return keys.some((key) => appConfig.tableAllowlist.includes(key));
};

export const formatRowCount = (count: number | null) => {
  if (count === null) {
    return null;
  }
  if (count >= 1000000) {
    return `${Math.round((count / 1000000) * 10) / 10}M`;
  }
  if (count >= 1000) {
    return `${Math.round((count / 1000) * 10) / 10}K`;
  }
  return String(count);
};

export const getDatabases = async () => {
  const pool = await getPool("master");
  const result = await pool.request().query<{ name: string }>(`
    SELECT name
    FROM sys.databases
    WHERE state_desc = 'ONLINE'
      AND HAS_DBACCESS(name) = 1
    ORDER BY name
  `);

  return result.recordset
    .map((row) => row.name)
    .filter((name) => !systemDatabases.has(name))
    .filter(isAllowedDatabase);
};

export const getTablesForDatabase = async (database: string): Promise<TableNode[]> => {
  const pool = await getPool(database);
  const result = await pool.request().query<{
    schema_name: string;
    table_name: string;
    description: string | null;
    row_count: number | null;
  }>(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      CAST(ep.value AS nvarchar(4000)) AS description,
      SUM(COALESCE(ps.row_count, 0)) AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    LEFT JOIN sys.extended_properties ep
      ON ep.major_id = t.object_id
      AND ep.minor_id = 0
      AND ep.name = 'MS_Description'
    LEFT JOIN sys.dm_db_partition_stats ps
      ON ps.object_id = t.object_id
      AND ps.index_id IN (0, 1)
    WHERE t.is_ms_shipped = 0
    GROUP BY s.name, t.name, CAST(ep.value AS nvarchar(4000))
    ORDER BY t.name
  `);

  return result.recordset
    .filter((row) => isAllowedTable(database, row.schema_name, row.table_name))
    .map((row) => ({
      database,
      schema: row.schema_name,
      name: row.table_name,
      description: row.description,
      rowCount: row.row_count,
      rowCountLabel: formatRowCount(row.row_count)
    }));
};

export const getMetadata = async (): Promise<DatabaseNode[]> => {
  const databases = await getDatabases();
  const nodes: DatabaseNode[] = [];

  for (const database of databases) {
    const tables = await getTablesForDatabase(database);
    nodes.push({
      name: database,
      description: null,
      tableCount: tables.length,
      tables
    });
  }

  return nodes;
};

export const getColumns = async (
  database: string,
  schemaName: string,
  tableName: string
): Promise<ColumnMeta[]> => {
  const pool = await getPool(database);
  const result = await pool
    .request()
    .input("schemaName", sql.NVarChar, schemaName)
    .input("tableName", sql.NVarChar, tableName)
    .query<{
      name: string;
      description: string | null;
      data_type: string;
      is_nullable: boolean;
      ordinal: number;
    }>(`
      SELECT
        c.name,
        CAST(ep.value AS nvarchar(4000)) AS description,
        ty.name AS data_type,
        c.is_nullable,
        c.column_id AS ordinal
      FROM sys.columns c
      INNER JOIN sys.tables t ON t.object_id = c.object_id
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN sys.extended_properties ep
        ON ep.major_id = c.object_id
        AND ep.minor_id = c.column_id
        AND ep.name = 'MS_Description'
      WHERE s.name = @schemaName
        AND t.name = @tableName
      ORDER BY c.column_id
    `);

  return result.recordset.map((row) => ({
    name: row.name,
    description: row.description,
    dataType: row.data_type,
    isNullable: row.is_nullable,
    ordinal: row.ordinal
  }));
};

export const resolveTable = async (database: string, table: string, schemaName?: string) => {
  if (!isAllowedDatabase(database)) {
    throw new Error("Database is not allowed.");
  }

  const tables = await getTablesForDatabase(database);
  const match = tables.find((candidate) => {
    if (schemaName) {
      return candidate.schema === schemaName && candidate.name === table;
    }
    return candidate.name === table;
  });

  if (!match) {
    throw new Error("Table is not available.");
  }

  return match;
};
