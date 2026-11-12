import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./errors";
import { chatRouter } from "./routes/chat";
import { userRouter } from "./routes/user";

export const app = express();

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

app.use(express.json({ limit: "32kb" }));
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(chatRouter);
app.use(userRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
