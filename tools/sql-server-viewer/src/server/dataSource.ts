import { getActiveDataSource } from "./activeDataSource";
import { getColumns, getMetadata, resolveTable } from "./metadata";
import { getMySqlColumns, getMySqlMetadata, resolveMySqlTable } from "./mysqlMetadata";

export const getDataSourceMetadata = () =>
  getActiveDataSource().id === "mysql" ? getMySqlMetadata() : getMetadata();

export const getDataSourceColumns = (database: string, schema: string | undefined, table: string) =>
  getActiveDataSource().id === "mysql" ? getMySqlColumns(database, table) : getColumns(database, schema ?? "dbo", table);

export const resolveDataSourceTable = (database: string, table: string, schema?: string) =>
  getActiveDataSource().id === "mysql" ? resolveMySqlTable(database, table) : resolveTable(database, table, schema);
