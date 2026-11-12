import { app } from "./app";
import { config } from "./config";
import { prisma } from "./db";

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`chat-backend listening on http://127.0.0.1:${config.port}`);
  console.log(`UI available at http://127.0.0.1:${config.port}/`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
