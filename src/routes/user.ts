import { Router } from "express";
import { z } from "zod";
import { createUser, listUserChats, listUsers } from "../chats";
import { parse, uuidSchema } from "../validate";

export const userRouter = Router();

userRouter.get("/users", async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

userRouter.get("/user/:userId/chats", async (req, res) => {
  const userId = parse(uuidSchema, req.params.userId);
  const chats = await listUserChats(userId);
  res.json({ chats });
});

const createUserBody = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

userRouter.post("/users", async (req, res) => {
  const body = parse(createUserBody, req.body ?? {});
  const user = await createUser(body.id, body.name);
  res.status(201).json(user);
});
