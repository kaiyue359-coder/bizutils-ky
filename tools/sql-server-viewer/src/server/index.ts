import Fastify from "fastify";
import cors from "@fastify/cors";
import { appConfig } from "./config";
import { demoMetadata, getDemoTableData } from "./demoData";
import { closePools } from "./sqlServer";
import { getMetadata } from "./metadata";
import { getTableData } from "./readonlyQueryBuilder";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true,
  mode: appConfig.demoMode ? "demo" : "sql-server"
}));

app.get("/api/metadata", async () => {
  if (appConfig.demoMode) {
    return { databases: demoMetadata };
  }
  const databases = await getMetadata();
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
  };
}>("/api/table-data", async (request) => {
  const page = Number(request.query.page ?? 1);
  const pageSize = Number(request.query.pageSize ?? appConfig.defaultPageSize);

  if (appConfig.demoMode) {
    return getDemoTableData({
      database: request.query.database,
      table: request.query.table,
      page,
      pageSize,
      search: request.query.search,
      sortColumn: request.query.sortColumn,
      sortDirection: request.query.sortDirection,
      filtersJson: request.query.filters
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
    filtersJson: request.query.filters
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
  await app.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  host: "127.0.0.1",
  port: appConfig.apiPort
});
