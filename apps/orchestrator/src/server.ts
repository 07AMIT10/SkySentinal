import { createServer } from "node:http";

import { readConfig } from "./config.js";
import { ApiRouter, createHttpHandler } from "./http.js";
import { createProviders } from "./providers.js";
import { RunEngine } from "./run-engine.js";

const config = readConfig();
const engine = new RunEngine(createProviders(config), config);
const router = new ApiRouter(engine);
const port = Number(process.env.PORT ?? 8080);

createServer(createHttpHandler(router)).listen(port, () => {
  console.log(`SkySentinel orchestrator listening on http://localhost:${port} (${config.demoMode ? "demo" : "live"} mode)`);
});
