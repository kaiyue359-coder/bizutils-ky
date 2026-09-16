import { appConfig } from "./config";
import { getMetadata } from "./metadata";
import { closePools } from "./sqlServer";

const main = async () => {
  if (appConfig.demoMode) {
    throw new Error("SQLSV_DEMO_MODE is true. Set SQLSV_DEMO_MODE=false in .env before checking SQL Server.");
  }

  const metadata = await getMetadata();
  const databaseCount = metadata.length;
  const tableCount = metadata.reduce((sum, database) => sum + database.tables.length, 0);

  console.log("SQL Server connection OK.");
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
  });
