import { appConfig } from "./config";

export type DataSourceId = "sqlserver" | "mysql";

type DataSourceSummary = {
  id: DataSourceId;
  label: string;
  configured: boolean;
};

let activeDataSourceId: DataSourceId = appConfig.dbClient;

const definitions: Record<DataSourceId, Omit<DataSourceSummary, "configured">> = {
  sqlserver: { id: "sqlserver", label: "SQL Server" },
  mysql: { id: "mysql", label: "MySQL" }
};

const isConfigured = (id: DataSourceId) => {
  const connection = id === "sqlserver" ? appConfig.sql : appConfig.mysql;
  return Boolean(connection.user && connection.password);
};

export const getAvailableDataSources = (): DataSourceSummary[] =>
  (Object.keys(definitions) as DataSourceId[]).map((id) => ({
    ...definitions[id],
    configured: isConfigured(id)
  }));

export const getActiveDataSource = () => ({
  ...definitions[activeDataSourceId],
  databaseAllowlist:
    activeDataSourceId === "mysql" ? appConfig.mysqlDatabaseAllowlist : appConfig.sqlServerDatabaseAllowlist,
  tableAllowlist:
    activeDataSourceId === "mysql" ? appConfig.mysqlTableAllowlist : appConfig.sqlServerTableAllowlist
});

export const setActiveDataSource = (id: string) => {
  if (id !== "sqlserver" && id !== "mysql") {
    throw new Error("Data source is not available.");
  }
  if (!isConfigured(id)) {
    throw new Error("Data source is not configured locally.");
  }
  activeDataSourceId = id;
};
