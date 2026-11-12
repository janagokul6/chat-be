import { prisma } from "./db";
import { badRequest, forbidden, notFound } from "./errors";

const MAX_GROUP_MEMBERS = 3;

export type ChatWithMembers = {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  members: { userId: string; user: { id: string; name: string | null } }[];
};

export function memberIds(chat: ChatWithMembers): string[] {
  return chat.members.map((m) => m.userId);
}

export function members(chat: ChatWithMembers): { id: string; name: string | null }[] {
  return chat.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
  }));
}

export function assertMember(chat: ChatWithMembers, userId: string): void {
  if (!chat.members.some((m) => m.userId === userId)) {
    throw forbidden("User is not a member of this chat");
  }
}

export async function requireUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw notFound("User");
  }
  return user;
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function createUser(id?: string, name?: string) {
  if (id) {
    const user = await prisma.user.upsert({
      where: { id },
      update: name ? { name } : {},
      create: { id, name: name ?? null },
    });
    return { id: user.id, name: user.name };
  }
  const user = await prisma.user.create({
    data: { name: name ?? null },
  });
  return { id: user.id, name: user.name };
}

export async function requireChat(chatId: string): Promise<ChatWithMembers> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!chat) {
    throw notFound("Chat");
  }
  return chat;
}

export async function createOrGetChat(userAId: string, userBId: string): Promise<string> {
  if (userAId === userBId) {
    throw badRequest("userAId and userBId must be different");
  }

  const [low, high] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

  const count = await prisma.user.count({
    where: { id: { in: [low, high] } },
  });
  if (count !== 2) {
    throw notFound("User");
  }

  const pairKey = `${low}:${high}`;
  const chat = await prisma.chat.upsert({
    where: { pairKey },
    update: {},
    create: {
      pairKey,
      isGroup: false,
      members: {
        create: [{ userId: low }, { userId: high }],
      },
    },
  });

  return chat.id;
}

export async function createGroupChat(name: string, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length < 2 || uniqueIds.length > MAX_GROUP_MEMBERS) {
    throw badRequest(`Group must have between 2 and ${MAX_GROUP_MEMBERS} members`);
  }

  const count = await prisma.user.count({
    where: { id: { in: uniqueIds } },
  });
  if (count !== uniqueIds.length) {
    throw notFound("User");
  }

  const chat = await prisma.chat.create({
    data: {
      name,
      isGroup: true,
      members: {
        create: uniqueIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return {
    chatId: chat.id,
    name: chat.name,
    isGroup: chat.isGroup,
    memberIds: memberIds(chat),
    members: members(chat),
  };
}

export async function addGroupMember(chatId: string, actorId: string, targetUserId: string) {
  const chat = await requireChat(chatId);
  if (!chat.isGroup) {
    throw badRequest("Cannot add members to a 1:1 chat");
  }
  assertMember(chat, actorId);

  if (chat.members.some((m) => m.userId === targetUserId)) {
    throw badRequest("User is already in the group");
  }
  if (chat.members.length >= MAX_GROUP_MEMBERS) {
    throw badRequest(`Group cannot have more than ${MAX_GROUP_MEMBERS} members`);
  }

  await requireUser(targetUserId);
  await prisma.chatMember.create({
    data: { chatId, userId: targetUserId },
  });

  const updated = await requireChat(chatId);
  return {
    chatId: updated.id,
    name: updated.name,
    isGroup: updated.isGroup,
    memberIds: memberIds(updated),
    members: members(updated),
  };
}

export async function removeGroupMember(chatId: string, actorId: string, targetUserId: string) {
  const chat = await requireChat(chatId);
  if (!chat.isGroup) {
    throw badRequest("Cannot remove members from a 1:1 chat");
  }
  assertMember(chat, actorId);

  if (!chat.members.some((m) => m.userId === targetUserId)) {
    throw notFound("Member");
  }

  await prisma.chatMember.delete({
    where: {
      chatId_userId: { chatId, userId: targetUserId },
    },
  });

  const updated = await requireChat(chatId);
  return {
    chatId: updated.id,
    name: updated.name,
    isGroup: updated.isGroup,
    memberIds: memberIds(updated),
    members: members(updated),
  };
}

export async function renameGroup(chatId: string, actorId: string, name: string) {
  const chat = await requireChat(chatId);
  if (!chat.isGroup) {
    throw badRequest("Cannot rename a 1:1 chat");
  }
  assertMember(chat, actorId);

  await prisma.chat.update({
    where: { id: chatId },
    data: { name },
  });

  const updated = await requireChat(chatId);
  return {
    chatId: updated.id,
    name: updated.name,
    isGroup: updated.isGroup,
    memberIds: memberIds(updated),
    members: members(updated),
  };
}

export async function listUserChats(userId: string) {
  await requireUser(userId);

  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return chats.map((chat) => ({
    chatId: chat.id,
    name: chat.name,
    isGroup: chat.isGroup,
    memberIds: memberIds(chat),
    members: members(chat),
  }));
}
