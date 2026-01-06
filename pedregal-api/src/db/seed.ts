import { db } from "./sqlite.js";
import { initSchema } from "./schema.js";

initSchema();

function tunnelCode(n: number) {
  return `T${String(n).padStart(2, "0")}`;
}

function seedPlant(plantId: string, name: string, tunnelCount: number, pincharCount: number) {
  db.prepare(`INSERT OR IGNORE INTO plants(id, name) VALUES(?, ?)`).run(plantId, name);

  const insTunnel = db.prepare(`
    INSERT OR IGNORE INTO tunnels(id, plant_id, code, name, enabled)
    VALUES(?, ?, ?, ?, 1)
  `);

  const insSensor = db.prepare(`
    INSERT OR IGNORE INTO sensors(tunnel_id, code, kind, enabled)
    VALUES(?, ?, ?, 1)
  `);

  for (let i = 1; i <= tunnelCount; i++) {
    const code = tunnelCode(i);
    const tunnelId = `${plantId}_${code}`;
    insTunnel.run(tunnelId, plantId, code, `${name} ${code}`);

    insSensor.run(tunnelId, "AMBIENT", "ambient");
    insSensor.run(tunnelId, "RETURN", "return");

    for (let p = 1; p <= pincharCount; p++) {
      insSensor.run(tunnelId, `P${String(p).padStart(2, "0")}`, "pinchar");
    }
  }
}

seedPlant("pk1", "PK1", 16, 8);
seedPlant("pk2", "PK2", 10, 10);
seedPlant("pk3", "PK3", 20, 24);

console.log("✅ Seed listo");
