import { appConfig } from "./config";
import { getActiveDataSource } from "./activeDataSource";
import type { RowDataPacket } from "mysql2";
import { getMySqlPool } from "./mysql";
import { formatRowCount } from "./metadata";
import type { ColumnMeta, DatabaseNode, TableNode } from "../shared/types";

const systemDatabases = new Set(["information_schema", "mysql", "performance_schema", "sys"]);
type DatabaseRow = RowDataPacket & { name: string };
type TableRow = RowDataPacket & { table_name: string; description: string | null; row_count: number | null };
type ColumnRow = RowDataPacket & {
  name: string;
  description: string | null;
  data_type: string;
  is_nullable: string;
  ordinal: number;
};

const isAllowedDatabase = (name: string) =>
  getActiveDataSource().databaseAllowlist.length === 0 || getActiveDataSource().databaseAllowlist.includes(name);

const isAllowedTable = (database: string, table: string) => {
  const { tableAllowlist } = getActiveDataSource();
  if (tableAllowlist.length === 0) {
    return true;
  }
  return [database + "." + table, table].some((key) => tableAllowlist.includes(key));
};

export const getMySqlDatabases = async () => {
  const [rows] = await getMySqlPool().query<DatabaseRow[]>(
    "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME"
  );
  return rows.map((row) => row.name).filter((name) => !systemDatabases.has(name)).filter(isAllowedDatabase);
};

export const getMySqlTablesForDatabase = async (database: string): Promise<TableNode[]> => {
  const [rows] = await getMySqlPool().query<TableRow[]>(
    `SELECT TABLE_NAME AS table_name, NULLIF(TABLE_COMMENT, '') AS description, TABLE_ROWS AS row_count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database]
  );

  return rows
    .filter((row) => isAllowedTable(database, row.table_name))
    .map((row) => ({
      database,
      schema: database,
      name: row.table_name,
      description: row.description,
      rowCount: row.row_count,
      rowCountLabel: formatRowCount(row.row_count)
    }));
};

export const getMySqlMetadata = async (): Promise<DatabaseNode[]> => {
  const databases = await getMySqlDatabases();
  return Promise.all(
    databases.map(async (database) => {
      const tables = await getMySqlTablesForDatabase(database);
      return { name: database, description: null, tableCount: tables.length, tables };
    })
  );
};

export const getMySqlColumns = async (database: string, tableName: string): Promise<ColumnMeta[]> => {
  const [rows] = await getMySqlPool().query<ColumnRow[]>(
    `SELECT COLUMN_NAME AS name, NULLIF(COLUMN_COMMENT, '') AS description, DATA_TYPE AS data_type,
            IS_NULLABLE AS is_nullable, ORDINAL_POSITION AS ordinal
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [database, tableName]
  );

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    dataType: row.data_type,
    isNullable: row.is_nullable === "YES",
    ordinal: row.ordinal
  }));
};

export const resolveMySqlTable = async (database: string, table: string) => {
  if (!isAllowedDatabase(database)) {
    throw new Error("Database is not allowed.");
  }
  const match = (await getMySqlTablesForDatabase(database)).find((candidate) => candidate.name === table);
  if (!match) {
    throw new Error("Table is not available.");
  }
  return match;
};
