import { prisma } from "./db";
import { badRequest, forbidden, notFound } from "./errors";

export type ChatWithUsers = {
  id: string;
  userLowId: string;
  userHighId: string;
  createdAt: Date;
  userLow: { id: string; name: string | null };
  userHigh: { id: string; name: string | null };
};

export function memberIds(chat: { userLowId: string; userHighId: string }): string[] {
  return [chat.userLowId, chat.userHighId];
}

export function members(chat: {
  userLow: { id: string; name: string | null };
  userHigh: { id: string; name: string | null };
}): { id: string; name: string | null }[] {
  return [
    { id: chat.userLow.id, name: chat.userLow.name },
    { id: chat.userHigh.id, name: chat.userHigh.name },
  ];
}

export function assertMember(chat: { userLowId: string; userHighId: string }, userId: string): void {
  if (chat.userLowId !== userId && chat.userHighId !== userId) {
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

export async function requireChat(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      userLow: true,
      userHigh: true,
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

  const chat = await prisma.chat.upsert({
    where: {
      userLowId_userHighId: {
        userLowId: low,
        userHighId: high,
      },
    },
    update: {},
    create: {
      userLowId: low,
      userHighId: high,
    },
  });

  return chat.id;
}

export async function listUserChats(userId: string) {
  await requireUser(userId);

  const chats = await prisma.chat.findMany({
    where: {
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    include: {
      userLow: true,
      userHigh: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return chats.map((chat) => ({
    chatId: chat.id,
    memberIds: [chat.userLowId, chat.userHighId],
    members: [
      { id: chat.userLow.id, name: chat.userLow.name },
      { id: chat.userHigh.id, name: chat.userHigh.name },
    ],
  }));
}
