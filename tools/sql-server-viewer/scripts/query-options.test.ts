import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSorts, validateFilters, validatePagination } from "../src/server/queryOptions";
import { getDemoTableData } from "../src/server/demoData";

test("sorts validate identifiers, directions, duplicates and legacy compatibility", () => {
  const allowed = new Set(["id", "name"]);
  assert.deepEqual(resolveSorts({ sortColumn: "id", sortDirection: "desc" }, allowed), [{ column: "id", direction: "desc" }]);
  for (const sorts of [[{ column: "id; DROP TABLE x", direction: "asc" }], [{ column: "id", direction: "DESC;" }], [{ column: "id", direction: "asc" }, { column: "id", direction: "desc" }]]) {
    assert.throws(() => resolveSorts({ sortsJson: JSON.stringify(sorts) }, allowed));
  }
  assert.throws(() => validateFilters('[{"column":"unknown","operator":"equals"}]', allowed));
  assert.throws(() => validateFilters('{}', allowed));
});

test("pagination rejects invalid input", () => {
  for (const page of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => validatePagination(page, 500));
  validatePagination(3, 500);
});

test("500 rows, last page, AND filtering and ordered multi-key sorting", () => {
  const base = { database: "order_data", table: "order_items", page: 1, pageSize: 500 };
  assert.equal(getDemoTableData(base).rows.length, 500);
  const last = getDemoTableData({ ...base, page: 999 });
  assert.equal(last.page, 3);
  assert.equal(last.rows.length, 260);
  const data = getDemoTableData({ ...base,
    filtersJson: JSON.stringify([{ column: "quantity", operator: "gte", value: "2" }, { column: "unit_price", operator: "gt", value: "25" }]),
    sortsJson: JSON.stringify([{ column: "quantity", direction: "asc" }, { column: "unit_price", direction: "desc" }])
  });
  assert.ok(data.rows.length > 100);
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    assert.ok(Number(row.quantity) >= 2 && Number(row.unit_price) > 25);
    const prev = data.rows[i - 1];
    if (prev) assert.ok(Number(prev.quantity) < Number(row.quantity) || (prev.quantity === row.quantity && Number(prev.unit_price) >= Number(row.unit_price)));
  }
  assert.equal(getDemoTableData({ ...base, filtersJson: '[{"column":"product_id","operator":"equals","value":"missing"}]' }).rowCount, 0);
});
