import type { DatabaseNode, TableDataResponse } from "../shared/types";

export type DataSource = {
  id: "sqlserver" | "mysql";
  label: string;
};

export const fetchDataSources = async () => {
  const response = await fetch("/api/data-sources");
  if (!response.ok) {
    throw new Error("Failed to load data sources.");
  }
  return (await response.json()) as { activeId: DataSource["id"]; sources: DataSource[] };
};

export const activateDataSource = async (id: DataSource["id"]) => {
  const response = await fetch(`/api/data-sources/${id}/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Failed to switch data source.");
  }
  return (await response.json()) as { activeId: DataSource["id"] };
};

export const fetchMetadata = async () => {
  const response = await fetch("/api/metadata");
  if (!response.ok) {
    throw new Error("Failed to load metadata.");
  }
  return (await response.json()) as { databases: DatabaseNode[] };
};

export const fetchTableData = async (params: {
  database: string;
  schema: string;
  table: string;
  page: number;
  pageSize: number;
  search: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filters?: Array<{ column: string; operator: string; value?: string }>;
}) => {
  const searchParams = new URLSearchParams({
    database: params.database,
    schema: params.schema,
    table: params.table,
    page: String(params.page),
    pageSize: String(params.pageSize)
  });

  if (params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.sortColumn) {
    searchParams.set("sortColumn", params.sortColumn);
    searchParams.set("sortDirection", params.sortDirection ?? "asc");
  }
  if (params.filters?.length) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }

  const response = await fetch(`/api/table-data?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load table data.");
  }
  return (await response.json()) as TableDataResponse;
};
