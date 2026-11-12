import { FieldPath, FieldValue, Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "./firestore";
import { forbidden, notFound } from "./errors";

export type Receipt = {
  userId: string;
  messageId: string;
  readAt: string | null;
};

export type LastSeen = {
  userId: string;
  messageId: string;
  updatedAt: string | null;
};

export type Message = {
  messageId: string;
  senderId: string;
  text: string;
  createdAt: string | null;
  editedAt?: string | null;
  readBy: Receipt[];
};

function messagesCol(chatId: string) {
  return firestore.collection("chats").doc(chatId).collection("messages");
}

function receiptsCol(chatId: string) {
  return firestore.collection("chats").doc(chatId).collection("readReceipts");
}

function lastSeenCol(chatId: string) {
  return firestore.collection("chats").doc(chatId).collection("lastSeen");
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

function serializeMessage(id: string, data: DocumentData, readBy: Receipt[] = []): Message {
  return {
    messageId: id,
    senderId: data.senderId as string,
    text: data.text as string,
    createdAt: toIso(data.createdAt),
    editedAt: toIso(data.editedAt),
    readBy,
  };
}

export async function requireMessage(chatId: string, messageId: string) {
  const snap = await messagesCol(chatId).doc(messageId).get();
  if (!snap.exists) {
    throw notFound("Message");
  }
  return snap;
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  const ref = messagesCol(chatId).doc();
  await ref.set({
    senderId,
    text,
    createdAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  const data = snap.data();
  if (!data) {
    throw new Error("Message was written but could not be read back");
  }
  return serializeMessage(snap.id, data);
}

export async function listReceipts(chatId: string): Promise<Receipt[]> {
  const snap = await receiptsCol(chatId).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: data.userId as string,
      messageId: data.messageId as string,
      readAt: toIso(data.readAt),
    };
  });
}

export async function listLastSeen(chatId: string): Promise<LastSeen[]> {
  const snap = await lastSeenCol(chatId).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: doc.id,
      messageId: data.messageId as string,
      updatedAt: toIso(data.updatedAt),
    };
  });
}

export async function listMessages(chatId: string, limit: number, before?: string): Promise<{ messages: Message[]; hasMore: boolean }> {
  let query = messagesCol(chatId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (before) {
    const cursor = await requireMessage(chatId, before);
    query = query.startAfter(cursor);
  }

  const [snap, receipts] = await Promise.all([
    query.limit(limit + 1).get(),
    listReceipts(chatId),
  ]);

  const hasMore = snap.docs.length > limit;
  const docs = (hasMore ? snap.docs.slice(0, limit) : snap.docs).slice().reverse();
  const byMessage = new Map<string, Receipt[]>();
  for (const receipt of receipts) {
    const list = byMessage.get(receipt.messageId) ?? [];
    list.push(receipt);
    byMessage.set(receipt.messageId, list);
  }

  return {
    messages: docs.map((doc: QueryDocumentSnapshot) =>
      serializeMessage(doc.id, doc.data(), byMessage.get(doc.id) ?? []),
    ),
    hasMore,
  };
}

export async function markRead(chatId: string, messageId: string, userId: string) {
  await requireMessage(chatId, messageId);
  const ref = receiptsCol(chatId).doc(`${userId}_${messageId}`);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      userId,
      messageId,
      readAt: FieldValue.serverTimestamp(),
    });
  }
  const snap = await ref.get();
  return {
    userId,
    messageId,
    readAt: toIso(snap.data()?.readAt),
  };
}

export async function updateLastSeen(chatId: string, userId: string, messageId: string) {
  await requireMessage(chatId, messageId);
  const ref = lastSeenCol(chatId).doc(userId);
  await ref.set({
    messageId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  return {
    userId,
    messageId,
    updatedAt: toIso(snap.data()?.updatedAt),
  };
}

export async function editMessage(chatId: string, messageId: string, senderId: string, text: string) {
  const ref = messagesCol(chatId).doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw notFound("Message");
  }
  const data = snap.data();
  if (!data) {
    throw notFound("Message");
  }
  if (data.senderId !== senderId) {
    throw forbidden("Cannot edit another user's message");
  }

  await ref.update({
    text,
    editedAt: FieldValue.serverTimestamp(),
  });

  const updated = await ref.get();
  const receipts = await listReceipts(chatId);
  const readBy = receipts.filter((r) => r.messageId === messageId);
  return serializeMessage(updated.id, updated.data()!, readBy);
}

export async function deleteMessage(chatId: string, messageId: string, senderId: string) {
  const ref = messagesCol(chatId).doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw notFound("Message");
  }
  const data = snap.data();
  if (!data) {
    throw notFound("Message");
  }
  if (data.senderId !== senderId) {
    throw forbidden("Cannot delete another user's message");
  }

  await ref.delete();
}
