import { appConfig } from "./config";
import { getActiveDataSource } from "./activeDataSource";
import { getDataSourceMetadata } from "./dataSource";
import { closePools } from "./sqlServer";
import { closeMySqlPool } from "./mysql";

const main = async () => {
  if (appConfig.demoMode) {
    throw new Error("SQLSV_DEMO_MODE is true. Set SQLSV_DEMO_MODE=false in .env before checking a database connection.");
  }

  const metadata = await getDataSourceMetadata();
  const databaseCount = metadata.length;
  const tableCount = metadata.reduce((sum, database) => sum + database.tables.length, 0);

  console.log(`${getActiveDataSource().id} connection OK.`);
  console.log(`Databases visible: ${databaseCount}`);
  console.log(`Tables visible: ${tableCount}`);
  for (const database of metadata.slice(0, 10)) {
    console.log(`- ${database.name}: ${database.tableCount} tables`);
  }
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`SQL Server connection check failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePools();
    await closeMySqlPool();
  });
