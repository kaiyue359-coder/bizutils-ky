import { z } from "zod";
import type { ColumnSort } from "../shared/types";

const sortsSchema = z.array(z.object({ column: z.string().min(1), direction: z.enum(["asc", "desc"]) }).strict()).max(20);
const filtersSchema = z.array(z.object({
  column: z.string().min(1),
  operator: z.enum(["contains", "equals", "startsWith", "gt", "gte", "lt", "lte", "isEmpty"]),
  value: z.string().max(4000).optional()
}).strict()).max(50);

export const parseFilters = (json?: string) => filtersSchema.parse(json ? JSON.parse(json) : []);

export const resolveSorts = (
  params: { sortsJson?: string; sortColumn?: string; sortDirection?: string },
  allowed: Set<string>
): ColumnSort[] => {
  const sorts = sortsSchema.parse(params.sortsJson ? JSON.parse(params.sortsJson) :
    params.sortColumn ? [{ column: params.sortColumn, direction: params.sortDirection ?? "asc" }] : []);
  const seen = new Set<string>();
  for (const sort of sorts) {
    if (!allowed.has(sort.column) || seen.has(sort.column)) throw new Error("Invalid or duplicate sort column.");
    seen.add(sort.column);
  }
  const first = allowed.values().next().value;
  if (!first) throw new Error("Table has no readable columns.");
  return sorts.length ? sorts : [{ column: first, direction: "asc" }];
};

export const validateFilters = (json: string | undefined, allowed: Set<string>) => {
  const filters = parseFilters(json);
  if (filters.some((filter) => !allowed.has(filter.column))) throw new Error("Invalid filter column.");
  return filters;
};

export const validatePagination = (page: number, pageSize: number) => {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 ||
      !Number.isSafeInteger((page - 1) * pageSize)) throw new Error("Invalid page or page size.");
};
