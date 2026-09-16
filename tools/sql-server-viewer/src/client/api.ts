import type { DatabaseNode, TableDataResponse } from "../shared/types";

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
