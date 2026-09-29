import mysql from "mysql2/promise";
import { appConfig } from "./config";

let pool: mysql.Pool | undefined;

export const quoteMySqlIdentifier = (identifier: string) => `\`${identifier.replaceAll("`", "``")}\``;

export const getMySqlPool = () => {
  if (!pool) {
    pool = mysql.createPool(appConfig.mysql);
  }
  return pool;
};

export const closeMySqlPool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
