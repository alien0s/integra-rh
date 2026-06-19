import { buildApp } from "./app.js";
import { getApiConfig } from "./plugins/env.js";

const app = buildApp();
const config = getApiConfig();

try {
  await app.listen({
    host: config.host,
    port: config.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
