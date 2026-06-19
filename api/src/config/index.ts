import * as dotenv from "dotenv";
import logger from "node-color-log";

dotenv.config();

const defaultCorsOrigins = [
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOrigins = (process.env.CORS_ORIGIN || defaultCorsOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  // Node environment
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  apiVersion: process.env.API_VERSION || "v1",

  // Database configuration
  database: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "pd2",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "",
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // External services
  //pd2ApiJwt: process.env.PD2_API_JWT || "", (for leaderboard/economy)
  //googleAiApiKey: process.env.GOOGLE_AI_API_KEY || "", (economy)

  // Season configuration
  currentSeason: parseInt(process.env.CURRENT_SEASON || "13", 10),

  // CORS
  corsOrigin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "15") * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "1000"),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
};

logger.setLevel(
  config.logLevel as "error" | "warn" | "info" | "debug" | "success"
);

export default config;
export { logger };
