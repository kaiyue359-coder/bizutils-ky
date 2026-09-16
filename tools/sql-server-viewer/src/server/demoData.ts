import type { ColumnMeta, DatabaseNode, TableDataResponse } from "../shared/types";

const orderColumns: ColumnMeta[] = [
  { name: "order_id", description: "订单号", dataType: "int", isNullable: false, ordinal: 1 },
  { name: "product_id", description: "商品编码", dataType: "nvarchar", isNullable: false, ordinal: 2 },
  { name: "product_name", description: "商品名称", dataType: "nvarchar", isNullable: false, ordinal: 3 },
  { name: "quantity", description: "数量", dataType: "int", isNullable: false, ordinal: 4 },
  { name: "unit_price", description: "单价", dataType: "decimal", isNullable: false, ordinal: 5 },
  { name: "amount", description: "实付金额", dataType: "decimal", isNullable: false, ordinal: 6 },
  { name: "created_at", description: "下单时间", dataType: "datetime2", isNullable: false, ordinal: 7 }
];

const products = [
  ["P001", "拿铁", 28],
  ["P002", "美式咖啡", 25],
  ["P003", "香草糖浆", 6],
  ["P004", "焦糖玛奇朵", 32],
  ["P005", "抹茶拿铁", 30],
  ["P006", "冰澳白", 29],
  ["P007", "冰淇淋咖啡", 34]
] as const;

const orderRows = Array.from({ length: 360 }, (_, index) => {
  const product = products[index % products.length];
  const quantity = (index % 3) + 1;
  const date = new Date("2024-09-15T12:30:21.000Z");
  date.setMinutes(date.getMinutes() + index * 2);

  return {
    id: index + 1,
    order_id: 1000001 + Math.floor(index / 2),
    product_id: product[0],
    product_name: product[1],
    quantity,
    unit_price: product[2],
    amount: product[2] * quantity,
    created_at: date.toISOString().replace("T", " ").slice(0, 19)
  };
});

export const demoMetadata: DatabaseNode[] = [
  {
    name: "order_data",
    description: "订单数据",
    tableCount: 4,
    tables: [
      { database: "order_data", schema: "dbo", name: "orders", description: "订单", rowCount: 1200000, rowCountLabel: "1.2M" },
      { database: "order_data", schema: "dbo", name: "order_items", description: "订单商品", rowCount: 3612584, rowCountLabel: "3.6M" },
      { database: "order_data", schema: "dbo", name: "payment_records", description: "支付明细", rowCount: 520000, rowCountLabel: "520K" },
      { database: "order_data", schema: "dbo", name: "refunds", description: "退款记录", rowCount: 210000, rowCountLabel: "210K" }
    ]
  },
  {
    name: "test_database",
    description: "测试数据库",
    tableCount: 8,
    tables: []
  },
  {
    name: "brand_data",
    description: "品牌资料",
    tableCount: 15,
    tables: []
  },
  {
    name: "weather_data",
    description: "气象资料",
    tableCount: 9,
    tables: []
  },
  {
    name: "device_management",
    description: "设备管理",
    tableCount: 18,
    tables: [
      { database: "device_management", schema: "dbo", name: "store_info", description: "门店资料", rowCount: 2100, rowCountLabel: "2.1K" },
      { database: "device_management", schema: "dbo", name: "space_info", description: "空间信息", rowCount: 1800, rowCountLabel: "1.8K" },
      { database: "device_management", schema: "dbo", name: "device_archive", description: "设备档案", rowCount: 5200, rowCountLabel: "5.2K" },
      { database: "device_management", schema: "dbo", name: "maintenance_records", description: "设备维修记录", rowCount: 12000, rowCountLabel: "12K" }
    ]
  }
];

export const getDemoTableData = (params: {
  database: string;
  table: string;
  page: number;
  pageSize: number;
  search?: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filtersJson?: string;
}): TableDataResponse => {
  const term = params.search?.toLowerCase().trim();
  let rows = [...orderRows];

  if (term) {
    rows = rows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(term))
    );
  }

  if (params.filtersJson) {
    const filters = JSON.parse(params.filtersJson) as Array<{
      column: keyof (typeof orderRows)[number];
      operator: string;
      value?: string;
    }>;
    for (const filter of filters) {
      rows = rows.filter((row) => {
        const value = String(row[filter.column] ?? "").toLowerCase();
        const expected = String(filter.value ?? "").toLowerCase();
        if (filter.operator === "equals") {
          return value === expected;
        }
        if (filter.operator === "startsWith") {
          return value.startsWith(expected);
        }
        return value.includes(expected);
      });
    }
  }

  if (params.sortColumn) {
    rows.sort((a, b) => {
      const left = a[params.sortColumn as keyof typeof a];
      const right = b[params.sortColumn as keyof typeof b];
      const result = String(left).localeCompare(String(right), "zh-CN", { numeric: true });
      return params.sortDirection === "desc" ? -result : result;
    });
  }

  const start = (params.page - 1) * params.pageSize;

  return {
    database: params.database,
    table: params.table,
    tableDescription: "订单商品",
    columns: orderColumns,
    rows: rows.slice(start, start + params.pageSize),
    rowCount: rows.length,
    page: params.page,
    pageSize: params.pageSize
  };
};
