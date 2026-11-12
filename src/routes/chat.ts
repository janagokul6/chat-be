import { Router } from "express";
import { z } from "zod";
import { addGroupMember, assertMember, createGroupChat, createOrGetChat, removeGroupMember, renameGroup, requireChat } from "../chats";
import { deleteMessage, editMessage, listLastSeen, listMessages, listReceipts, markRead, sendMessage, updateLastSeen } from "../messages";
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

const createGroupBody = z.object({
  name: z.string().trim().min(1).max(80),
  memberIds: z.array(uuidSchema).min(2).max(3),
});

chatRouter.post("/chat/group/create", async (req, res) => {
  const { name, memberIds } = parse(createGroupBody, req.body);
  const group = await createGroupChat(name, memberIds);
  res.status(201).json(group);
});

const renameBody = z.object({
  userId: uuidSchema,
  name: z.string().trim().min(1).max(80),
});

chatRouter.patch("/chat/:chatId", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { userId, name } = parse(renameBody, req.body);
  const updated = await renameGroup(chatId, userId, name);
  res.json(updated);
});

const memberBody = z.object({
  userId: uuidSchema,
  memberId: uuidSchema,
});

chatRouter.post("/chat/:chatId/members", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const { userId, memberId } = parse(memberBody, req.body);
  const updated = await addGroupMember(chatId, userId, memberId);
  res.json(updated);
});

chatRouter.delete("/chat/:chatId/members/:memberId", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const memberId = parse(uuidSchema, req.params.memberId);
  const userId = req.query?.userId ?? req.body?.userId;
  const parsed = parse(z.object({ userId: uuidSchema }), { userId });
  const updated = await removeGroupMember(chatId, parsed.userId, memberId);
  res.json(updated);
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

const editBody = z.object({
  userId: uuidSchema,
  text: z.string().trim().min(1).max(4000),
});

chatRouter.patch("/chat/:chatId/message/:messageId", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const messageId = parse(messageIdSchema, req.params.messageId);
  const { userId, text } = parse(editBody, req.body);
  const chat = await requireChat(chatId);
  assertMember(chat, userId);
  const updated = await editMessage(chatId, messageId, userId, text);
  res.json(updated);
});

const deleteBody = z.object({
  userId: uuidSchema,
});

chatRouter.delete("/chat/:chatId/message/:messageId", async (req, res) => {
  const chatId = parse(uuidSchema, req.params.chatId);
  const messageId = parse(messageIdSchema, req.params.messageId);
  const userId = req.body?.userId ?? req.query?.userId;
  const parsed = parse(deleteBody, { userId });
  const chat = await requireChat(chatId);
  assertMember(chat, parsed.userId);
  await deleteMessage(chatId, messageId, parsed.userId);
  res.status(204).end();
});
