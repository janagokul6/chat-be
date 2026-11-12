const COLORS = [
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#4f46e5",
  "#ea580c"
];

let currentUser = null;
let activeContact = null;
let activeChatId = null;
let currentChatSession = 0;
let isPolling = false;
const markedReadIds = new Set();

const myAvatar = document.getElementById("my-avatar");
const myName = document.getElementById("my-name");
const switchUserBtn = document.getElementById("switch-user-btn");
const newUserBtn = document.getElementById("new-user-btn");
const contactList = document.getElementById("contact-list");
const emptyState = document.getElementById("empty-state");
const chatView = document.getElementById("chat-view");
const activeAvatar = document.getElementById("active-avatar");
const activeName = document.getElementById("active-name");
const refreshChatBtn = document.getElementById("refresh-chat-btn");
const messagesContainer = document.getElementById("messages-container");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const userModal = document.getElementById("user-modal");
const userOptions = document.getElementById("user-options");
const modalCloseBtn = document.getElementById("modal-close-btn");
const createUserForm = document.getElementById("create-user-form");
const newUserNameInput = document.getElementById("new-user-name");

async function api(method, path, body) {
  const options = {
    method,
    headers: {}
  };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function getAvatarColor(name) {
  const str = name || "User";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function setAvatar(element, name) {
  element.textContent = getInitials(name);
  element.style.backgroundColor = getAvatarColor(name);
}

async function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem("chat_user_id", user.id);
  setAvatar(myAvatar, user.name);
  myName.textContent = user.name || "User";

  if (activeContact && activeContact.id === user.id) {
    activeContact = null;
    activeChatId = null;
    chatView.classList.add("hidden");
    emptyState.classList.remove("hidden");
  }

  await loadContacts();
  if (activeContact) {
    await openChat(activeContact);
  }
}

async function loadContacts() {
  const data = await api("GET", "/users");
  const users = data.users || [];

  contactList.innerHTML = "";
  const contacts = users.filter((u) => u.id !== currentUser?.id);

  if (contacts.length === 0) {
    contactList.innerHTML = `<div style="padding:1rem;color:var(--text-muted);font-size:0.85rem;text-align:center;">No other users yet. Click "+ User" to create one.</div>`;
    return;
  }

  contacts.forEach((contact) => {
    const item = document.createElement("div");
    item.className = `contact-item ${activeContact?.id === contact.id ? "active" : ""}`;
    item.dataset.userId = contact.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.width = "36px";
    avatar.style.height = "36px";
    avatar.style.fontSize = "0.85rem";
    setAvatar(avatar, contact.name);

    const info = document.createElement("div");
    info.className = "contact-info";

    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = contact.name || "User";

    const status = document.createElement("div");
    status.className = "contact-status";
    status.textContent = "Click to message";

    info.appendChild(name);
    info.appendChild(status);
    item.appendChild(avatar);
    item.appendChild(info);

    item.addEventListener("click", () => openChat(contact));
    contactList.appendChild(item);
  });
}

async function openChat(contact) {
  const session = ++currentChatSession;
  activeContact = contact;
  activeChatId = null;

  setAvatar(activeAvatar, contact.name);
  activeName.textContent = contact.name || "User";

  const items = contactList.querySelectorAll(".contact-item");
  items.forEach((it) => it.classList.remove("active"));
  const clicked = contactList.querySelector(`[data-user-id="${contact.id}"]`);
  if (clicked) clicked.classList.add("active");

  emptyState.classList.add("hidden");
  chatView.classList.remove("hidden");
  messagesContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Loading messages...</div>`;

  try {
    const chat = await api("POST", "/chat/create", {
      userAId: currentUser.id,
      userBId: contact.id
    });
    if (session !== currentChatSession) return;
    activeChatId = chat.chatId;
    messagesContainer.innerHTML = "";
    await loadMessages(session, true);
    messageInput.focus();
  } catch (err) {
    if (session !== currentChatSession) return;
    messagesContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Could not load chat: ${err.message}</div>`;
  }
}

function renderMessageRow(msg, isOutgoing, isReadByOther, isPending = false) {
  const row = document.createElement("div");
  row.className = `message-row ${isOutgoing ? "outgoing" : "incoming"}`;
  row.dataset.id = msg.messageId;

  if (!isOutgoing) {
    const senderAvatar = document.createElement("div");
    senderAvatar.className = "message-avatar";
    setAvatar(senderAvatar, activeContact?.name);
    row.appendChild(senderAvatar);
  }

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isPending ? "pending" : ""}`;

  const text = document.createElement("div");
  text.className = "bubble-text";
  text.textContent = msg.text;

  const meta = document.createElement("div");
  meta.className = "bubble-meta";

  const time = document.createElement("span");
  time.textContent = isPending ? "Sending..." : formatTime(msg.createdAt);
  meta.appendChild(time);

  if (isOutgoing) {
    const status = document.createElement("span");
    status.className = `status-check ${isReadByOther ? "read" : ""}`;
    status.textContent = isPending ? "🕒" : isReadByOther ? "✓✓" : "✓";
    meta.appendChild(status);
  }

  bubble.appendChild(text);
  bubble.appendChild(meta);
  row.appendChild(bubble);
  return row;
}

async function loadMessages(expectedSession = currentChatSession, forceScroll = false) {
  if (!activeChatId || !currentUser || expectedSession !== currentChatSession) return;

  try {
    const data = await api(
      "GET",
      `/chat/${activeChatId}/messages?limit=50&userId=${currentUser.id}`
    );
    if (expectedSession !== currentChatSession) return;

    const messages = data.messages || [];
    const isNearBottom =
      forceScroll ||
      messagesContainer.scrollHeight -
        messagesContainer.scrollTop -
        messagesContainer.clientHeight <
        120;

    let unreadIncoming = null;

    const currentRows = new Map();
    messagesContainer.querySelectorAll(".message-row").forEach((el) => {
      currentRows.set(el.dataset.id, el);
    });

    messages.forEach((msg) => {
      const isOutgoing = msg.senderId === currentUser.id;
      const isReadByOther =
        isOutgoing &&
        activeContact &&
        (msg.readBy || []).some((r) => r.userId === activeContact.id);

      const existing = currentRows.get(msg.messageId);

      if (!existing) {
        const row = renderMessageRow(msg, isOutgoing, isReadByOther, false);
        messagesContainer.appendChild(row);
      } else {
        if (isOutgoing) {
          const status = existing.querySelector(".status-check");
          if (status) {
            status.className = `status-check ${isReadByOther ? "read" : ""}`;
            status.textContent = isReadByOther ? "✓✓" : "✓";
          }
          const time = existing.querySelector(".bubble-meta span:first-child");
          if (time && time.textContent === "Sending...") {
            time.textContent = formatTime(msg.createdAt);
          }
        }
        currentRows.delete(msg.messageId);
      }

      if (!isOutgoing) {
        const hasRead = (msg.readBy || []).some((r) => r.userId === currentUser.id);
        if (!hasRead && !markedReadIds.has(msg.messageId)) {
          unreadIncoming = msg;
        }
      }
    });

    if (unreadIncoming) {
      markedReadIds.add(unreadIncoming.messageId);
      api("POST", `/chat/${activeChatId}/message/${unreadIncoming.messageId}/read`, {
        userId: currentUser.id
      }).catch(() => {});
      api("POST", `/chat/${activeChatId}/lastseen`, {
        userId: currentUser.id,
        messageId: unreadIncoming.messageId
      }).catch(() => {});
    }

    if (isNearBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (err) {
    console.error("Message polling failed", err);
  }
}

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeChatId || !currentUser) return;

  const tempId = "temp-" + Date.now();
  const targetChatId = activeChatId;
  const session = currentChatSession;

  const tempMsg = {
    messageId: tempId,
    senderId: currentUser.id,
    text,
    createdAt: new Date().toISOString()
  };
  const tempRow = renderMessageRow(tempMsg, true, false, true);
  messagesContainer.appendChild(tempRow);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  messageInput.value = "";
  messageInput.focus();

  try {
    const sent = await api("POST", `/chat/${targetChatId}/message/send`, {
      senderId: currentUser.id,
      text
    });

    if (session === currentChatSession) {
      tempRow.dataset.id = sent.messageId;
      const bubble = tempRow.querySelector(".bubble");
      if (bubble) bubble.classList.remove("pending");

      const time = tempRow.querySelector(".bubble-meta span:first-child");
      if (time) time.textContent = formatTime(sent.createdAt);

      const status = tempRow.querySelector(".status-check");
      if (status) {
        status.textContent = "✓";
      }
    }
  } catch (err) {
    if (session === currentChatSession) {
      const status = tempRow.querySelector(".status-check");
      if (status) {
        status.textContent = "⚠️";
        status.title = "Failed to send: " + err.message;
      }
    }
  }
});

refreshChatBtn.addEventListener("click", async () => {
  if (!activeChatId) return;
  refreshChatBtn.classList.add("spinning");
  await loadMessages(currentChatSession, false);
  setTimeout(() => refreshChatBtn.classList.remove("spinning"), 600);
});

async function showUserModal() {
  const data = await api("GET", "/users");
  const users = data.users || [];

  userOptions.innerHTML = "";
  users.forEach((u) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "user-option-btn";

    const av = document.createElement("div");
    av.className = "avatar";
    av.style.width = "32px";
    av.style.height = "32px";
    av.style.fontSize = "0.8rem";
    setAvatar(av, u.name);

    const label = document.createElement("span");
    label.textContent = u.name + (u.id === currentUser?.id ? " (current)" : "");

    btn.appendChild(av);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      userModal.classList.add("hidden");
      void setCurrentUser(u);
    });
    userOptions.appendChild(btn);
  });

  userModal.classList.remove("hidden");
}

switchUserBtn.addEventListener("click", () => showUserModal());
newUserBtn.addEventListener("click", () => {
  showUserModal();
  setTimeout(() => newUserNameInput.focus(), 50);
});
modalCloseBtn.addEventListener("click", () => userModal.classList.add("hidden"));

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newUserNameInput.value.trim();
  if (!name) return;

  try {
    const user = await api("POST", "/users", { name });
    newUserNameInput.value = "";
    userModal.classList.add("hidden");
    await setCurrentUser(user);
  } catch (err) {
    alert("Failed to create user: " + err.message);
  }
});

async function init() {
  const data = await api("GET", "/users");
  const users = data.users || [];
  const storedId = localStorage.getItem("chat_user_id");
  const matched = users.find((u) => u.id === storedId);

  if (matched) {
    await setCurrentUser(matched);
  } else if (users.length > 0) {
    await setCurrentUser(users[0]);
  } else {
    showUserModal();
  }

  setInterval(async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      if (activeChatId) {
        await loadMessages(currentChatSession, false);
      }
    } finally {
      isPolling = false;
    }
  }, 900);
}

init().catch((err) => console.error(err));
