import { db } from "../db/sqlite.js";
import type { FastifyInstance } from "fastify";

export async function tunnelsRoutes(app: FastifyInstance) {
  app.get("/tunnels", async (req, reply) => {
    const { plant } = req.query as { plant?: string };
    if (!plant) return reply.code(400).send({ error: "missing plant" });

    const tunnels = db.prepare(`
      SELECT id, code, name, type
      FROM tunnels
      WHERE plant_id = ? AND enabled = 1
      ORDER BY code ASC
    `).all(plant);

    return { plant, tunnels };
  });
}
