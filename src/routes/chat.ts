import { Router } from "express";
import { z } from "zod";
import { assertMember, createOrGetChat, requireChat } from "../chats";
import { listLastSeen, listMessages, listReceipts, markRead, sendMessage, updateLastSeen } from "../messages";
import { parse, uuidSchema } from "../validate";

export const chatRouter = Router();

const createBody = z.object({
  userAId: uuidSchema,
  userBId: uuidSchema,
});

chatRouter.post("/chat/create", async (req, res) => {
  const { userAId, userBId } = parse(createBody, req.body);
  const chatId = await createOrGetChat(userAId, userBId);
  res.json({ chatId });
});

const sendBody = z.object({
  senderId: uuidSchema,
  text: z.string().trim().min(1).max(4000),
});

chatRouter.post("/chat/:chatId/message/send", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { senderId, text } = parse(sendBody, req.body);
  const chat = await requireChat(chatId);
  assertMember(chat, senderId);
  const message = await sendMessage(chatId, senderId, text);
  res.status(201).json(message);
});

const limitSchema = z.coerce.number().int().min(1).max(100).default(50);
const messageIdSchema = z.string().min(1).max(128);
const viewerQuery = z.object({
  userId: uuidSchema.optional(),
  limit: limitSchema.optional(),
  before: messageIdSchema.optional(),
});

chatRouter.get("/chat/:chatId/messages", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const query = parse(viewerQuery, req.query);
  const chat = await requireChat(chatId);
  if (query.userId) {
    assertMember(chat, query.userId);
  }
  const [result, lastSeen] = await Promise.all([
    listMessages(chatId, query.limit ?? 50, query.before),
    listLastSeen(chatId),
  ]);
  res.json({ messages: result.messages, hasMore: result.hasMore, lastSeen });
});

const readBody = z.object({
  userId: uuidSchema,
});

chatRouter.post("/chat/:chatId/message/:messageId/read", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const messageId = parse(messageIdSchema, req.params.messageId);
  const { userId } = parse(readBody, req.body);
  const chat = await requireChat(chatId);
  assertMember(chat, userId);
  const receipt = await markRead(chatId, messageId, userId);
  res.json(receipt);
});

chatRouter.get("/chat/:chatId/receipts", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { userId } = parse(z.object({ userId: uuidSchema }), req.query);
  const chat = await requireChat(chatId);
  assertMember(chat, userId);
  const receipts = await listReceipts(chatId);
  res.json({ receipts });
});

const lastSeenBody = z.object({
  userId: uuidSchema,
  messageId: messageIdSchema,
});

chatRouter.post("/chat/:chatId/lastseen", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { userId, messageId } = parse(lastSeenBody, req.body);
  const chat = await requireChat(chatId);
  assertMember(chat, userId);
  const result = await updateLastSeen(chatId, userId, messageId);
  res.json(result);
});

chatRouter.get("/chat/:chatId/lastseen", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { userId } = parse(z.object({ userId: uuidSchema }), req.query);
  const chat = await requireChat(chatId);
  assertMember(chat, userId);
  const lastSeen = await listLastSeen(chatId);
  res.json({ lastSeen });
});
