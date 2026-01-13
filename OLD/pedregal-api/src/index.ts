import Fastify from "fastify";
import cors from "@fastify/cors";
import { initSchema } from "./db/schema.js";

import { tunnelsRoutes } from "./modules/tunnels.routes.js";
import { processesRoutes } from "./modules/processes.routes.js";
import { generateRoutes } from "./modules/generate.routes.js";

initSchema();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

await app.register(tunnelsRoutes, { prefix: "/api" });
await app.register(processesRoutes, { prefix: "/api" });
await app.register(generateRoutes, { prefix: "/api" });

app.listen({ port: 3000, host: "0.0.0.0" });
