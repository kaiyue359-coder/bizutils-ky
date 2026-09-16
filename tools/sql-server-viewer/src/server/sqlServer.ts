import sql from "mssql";
import { appConfig } from "./config";

const pools = new Map<string, Promise<sql.ConnectionPool>>();

export const quoteIdentifier = (identifier: string) => `[${identifier.replaceAll("]", "]]")}]`;

export const getPool = (database = "master") => {
  const key = database;
  const existing = pools.get(key);
  if (existing) {
    return existing;
  }

  const poolPromise = new sql.ConnectionPool({
    ...appConfig.sql,
    database
  })
    .connect()
    .then((pool) => pool);

  pools.set(key, poolPromise);
  return poolPromise;
};

export const closePools = async () => {
  const activePools = await Promise.allSettled([...pools.values()]);
  await Promise.all(
    activePools.map((result) => {
      if (result.status === "fulfilled") {
        return result.value.close();
      }
      return Promise.resolve();
    })
  );
  pools.clear();
};

export { sql };
