import { getActiveDataSource } from "./activeDataSource";
import { getMySqlTableData } from "./mysqlReadonlyQueryBuilder";
import { getTableData as getSqlServerTableData } from "./readonlyQueryBuilder";

export const getTableData = (params: Parameters<typeof getSqlServerTableData>[0]) =>
  getActiveDataSource().id === "mysql" ? getMySqlTableData(params) : getSqlServerTableData(params);
