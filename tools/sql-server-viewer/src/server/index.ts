import Fastify from "fastify";
import cors from "@fastify/cors";
import { appConfig } from "./config";
import { getActiveDataSource, getAvailableDataSources, setActiveDataSource } from "./activeDataSource";
import { demoMetadata, getDemoTableData } from "./demoData";
import { closePools } from "./sqlServer";
import { closeMySqlPool } from "./mysql";
import { getDataSourceMetadata } from "./dataSource";
import { getTableData } from "./tableData";
import { validatePagination } from "./queryOptions";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true,
  mode: appConfig.demoMode ? "demo" : getActiveDataSource().id
}));

app.get("/api/data-sources", async () => ({
  activeId: getActiveDataSource().id,
  sources: getAvailableDataSources().filter((source) => source.configured)
}));

app.post<{ Params: { id: string } }>("/api/data-sources/:id/activate", async (request) => {
  const previousId = getActiveDataSource().id;
  setActiveDataSource(request.params.id);
  try {
    await getDataSourceMetadata();
    return { activeId: getActiveDataSource().id };
  } catch (error) {
    setActiveDataSource(previousId);
    throw error;
  }
});

app.get("/api/metadata", async () => {
  if (appConfig.demoMode) {
    return { databases: demoMetadata };
  }
  const databases = await getDataSourceMetadata();
  return { databases };
});

app.get<{
  Querystring: {
    database: string;
    table: string;
    schema?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    sortColumn?: string;
    sortDirection?: "asc" | "desc";
    filters?: string;
    sorts?: string;
  };
}>("/api/table-data", async (request) => {
  const page = Number(request.query.page ?? 1);
  const requestedSize = Number(request.query.pageSize ?? appConfig.defaultPageSize);
  validatePagination(page, requestedSize);
  const pageSize = Math.min(requestedSize, appConfig.maxPageSize, 500);

  if (appConfig.demoMode) {
    return getDemoTableData({
      database: request.query.database,
      table: request.query.table,
      page,
      pageSize,
      search: request.query.search,
      sortColumn: request.query.sortColumn,
      sortDirection: request.query.sortDirection,
      filtersJson: request.query.filters,
      sortsJson: request.query.sorts
    });
  }

  return getTableData({
    database: request.query.database,
    schema: request.query.schema,
    table: request.query.table,
    page,
    pageSize,
    search: request.query.search,
    sortColumn: request.query.sortColumn,
    sortDirection: request.query.sortDirection,
    filtersJson: request.query.filters,
    sortsJson: request.query.sorts
  });
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.status(400).send({
    error: "Request failed",
    message
  });
});

const shutdown = async () => {
  await closePools();
  await closeMySqlPool();
  await app.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  host: "127.0.0.1",
  port: appConfig.apiPort
});
