import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  SQLSV_DB_CLIENT: z.enum(["sqlserver", "mysql"]).optional().default("sqlserver"),
  SQLSV_DEMO_MODE: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  SQLSV_HOST: z.string().optional().default("localhost"),
  SQLSV_PORT: z.coerce.number().optional().default(1433),
  SQLSV_USER: z.string().optional().default(""),
  SQLSV_PASSWORD: z.string().optional().default(""),
  SQLSV_ENCRYPT: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  SQLSV_TRUST_SERVER_CERTIFICATE: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  SQLSV_DATABASE_ALLOWLIST: z.string().optional().default(""),
  SQLSV_TABLE_ALLOWLIST: z.string().optional().default(""),
  SQLSV_DEFAULT_PAGE_SIZE: z.coerce.number().optional().default(100),
  SQLSV_MAX_PAGE_SIZE: z.coerce.number().optional().default(500),
  SQLSV_API_PORT: z.coerce.number().optional().default(3001),
  MYSQL_HOST: z.string().optional().default("localhost"),
  MYSQL_PORT: z.coerce.number().optional().default(3306),
  MYSQL_USER: z.string().optional().default(""),
  MYSQL_PASSWORD: z.string().optional().default(""),
  MYSQL_DATABASE_ALLOWLIST: z.string().optional().default(""),
  MYSQL_TABLE_ALLOWLIST: z.string().optional().default("")
});

const parsed = schema.parse(process.env);

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const appConfig = {
  dbClient: parsed.SQLSV_DB_CLIENT,
  demoMode: parsed.SQLSV_DEMO_MODE,
  apiPort: parsed.SQLSV_API_PORT,
  defaultPageSize: parsed.SQLSV_DEFAULT_PAGE_SIZE,
  maxPageSize: parsed.SQLSV_MAX_PAGE_SIZE,
  sqlServerDatabaseAllowlist: splitList(parsed.SQLSV_DATABASE_ALLOWLIST),
  sqlServerTableAllowlist: splitList(parsed.SQLSV_TABLE_ALLOWLIST),
  mysqlDatabaseAllowlist: splitList(parsed.MYSQL_DATABASE_ALLOWLIST),
  mysqlTableAllowlist: splitList(parsed.MYSQL_TABLE_ALLOWLIST),
  sql: {
    server: parsed.SQLSV_HOST,
    port: parsed.SQLSV_PORT,
    user: parsed.SQLSV_USER,
    password: parsed.SQLSV_PASSWORD,
    options: {
      encrypt: parsed.SQLSV_ENCRYPT,
      trustServerCertificate: parsed.SQLSV_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },
  mysql: {
    host: parsed.MYSQL_HOST,
    port: parsed.MYSQL_PORT,
    user: parsed.MYSQL_USER,
    password: parsed.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true
  }
};
