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
let allUsers = [];
let userGroups = [];
let activeTarget = null;
let activeChatId = null;
let currentChatSession = 0;
let isPolling = false;
let pollCount = 0;
const markedReadIds = new Set();

const myAvatar = document.getElementById("my-avatar");
const myName = document.getElementById("my-name");
const switchUserBtn = document.getElementById("switch-user-btn");
const newUserBtn = document.getElementById("new-user-btn");
const newGroupBtn = document.getElementById("new-group-btn");
const groupsSection = document.getElementById("groups-section");
const groupList = document.getElementById("group-list");
const contactList = document.getElementById("contact-list");
const emptyState = document.getElementById("empty-state");
const chatView = document.getElementById("chat-view");
const activeAvatar = document.getElementById("active-avatar");
const activeName = document.getElementById("active-name");
const activeStatus = document.getElementById("active-status");
const manageGroupBtn = document.getElementById("manage-group-btn");
const refreshChatBtn = document.getElementById("refresh-chat-btn");
const messagesContainer = document.getElementById("messages-container");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

const userModal = document.getElementById("user-modal");
const userOptions = document.getElementById("user-options");
const modalCloseBtn = document.getElementById("modal-close-btn");
const createUserForm = document.getElementById("create-user-form");
const newUserNameInput = document.getElementById("new-user-name");

const groupModal = document.getElementById("group-modal");
const groupModalCloseBtn = document.getElementById("group-modal-close-btn");
const createGroupForm = document.getElementById("create-group-form");
const groupNameInput = document.getElementById("group-name-input");
const groupMemberOptions = document.getElementById("group-member-options");

const manageGroupModal = document.getElementById("manage-group-modal");
const manageModalCloseBtn = document.getElementById("manage-modal-close-btn");
const renameGroupForm = document.getElementById("rename-group-form");
const renameGroupInput = document.getElementById("rename-group-input");
const manageMembersList = document.getElementById("manage-members-list");
const addMemberSection = document.getElementById("add-member-section");
const addMemberSelect = document.getElementById("add-member-select");
const addMemberBtn = document.getElementById("add-member-btn");

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

function findUserName(userId) {
  if (activeTarget?.type === "group") {
    const member = activeTarget.group.members.find((m) => m.id === userId);
    if (member) return member.name || "User";
  }
  const found = allUsers.find((u) => u.id === userId);
  return found?.name || "User";
}

async function setCurrentUser(user) {
  const isSwitching = currentUser && currentUser.id !== user.id;
  currentUser = user;
  localStorage.setItem("chat_user_id", user.id);
  setAvatar(myAvatar, user.name);
  myName.textContent = user.name || "User";

  if (isSwitching) {
    localStorage.removeItem("chat_active_type");
    localStorage.removeItem("chat_active_target_id");
    activeTarget = null;
    activeChatId = null;
    chatView.classList.add("hidden");
    emptyState.classList.remove("hidden");
  }

  return loadSidebar();
}

async function loadSidebar() {
  const [usersData, chatsData] = await Promise.all([
    api("GET", "/users"),
    currentUser ? api("GET", `/user/${currentUser.id}/chats`) : Promise.resolve({ chats: [] })
  ]);

  allUsers = usersData.users || [];
  userGroups = (chatsData.chats || []).filter((c) => c.isGroup);

  renderGroups();
  renderContacts();
  return { users: allUsers, groups: userGroups };
}

function renderGroups() {
  groupList.innerHTML = "";
  if (userGroups.length === 0) {
    groupsSection.classList.add("hidden");
    return;
  }

  groupsSection.classList.remove("hidden");
  userGroups.forEach((group) => {
    const isActive = activeTarget?.type === "group" && activeTarget.group.chatId === group.chatId;
    const item = document.createElement("div");
    item.className = `contact-item ${isActive ? "active" : ""}`;
    item.dataset.groupId = group.chatId;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.width = "36px";
    avatar.style.height = "36px";
    avatar.style.fontSize = "0.85rem";
    setAvatar(avatar, group.name);

    const info = document.createElement("div");
    info.className = "contact-info";

    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = group.name || "Group";

    const status = document.createElement("div");
    status.className = "contact-status";
    status.textContent = group.members.map((m) => m.name || "User").join(", ");

    info.appendChild(name);
    info.appendChild(status);
    item.appendChild(avatar);
    item.appendChild(info);

    item.addEventListener("click", () => openGroupChat(group));
    groupList.appendChild(item);
  });
}

function renderContacts() {
  contactList.innerHTML = "";
  const contacts = allUsers.filter((u) => u.id !== currentUser?.id);

  if (contacts.length === 0) {
    contactList.innerHTML = `<div style="padding:1rem;color:var(--text-muted);font-size:0.85rem;text-align:center;">No other users yet. Click "+ User" to create one.</div>`;
    return;
  }

  contacts.forEach((contact) => {
    const isActive = activeTarget?.type === "dm" && activeTarget.contact.id === contact.id;
    const item = document.createElement("div");
    item.className = `contact-item ${isActive ? "active" : ""}`;
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

    item.addEventListener("click", () => openDmChat(contact));
    contactList.appendChild(item);
  });
}

function attachActions(contentWrapper, row) {
  if (contentWrapper.querySelector(".message-actions")) return;
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-action";
  editBtn.title = "Edit message";
  editBtn.textContent = "✏️";
  editBtn.addEventListener("click", () => onEditMessage(row._msg));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-action delete";
  deleteBtn.title = "Delete message";
  deleteBtn.textContent = "🗑️";
  deleteBtn.addEventListener("click", () => onDeleteMessage(row._msg));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  contentWrapper.appendChild(actions);
}

function getReadInfo(msg, isOutgoing) {
  if (!isOutgoing) return { isRead: false, title: "" };
  const readers = (msg.readBy || []).filter((r) => r.userId !== currentUser.id);
  if (readers.length === 0) return { isRead: false, title: "Sent" };
  const names = readers.map((r) => findUserName(r.userId));
  return { isRead: true, title: `Read by ${names.join(", ")}` };
}

function renderMessageRow(msg, isOutgoing, readInfo, isPending = false) {
  const row = document.createElement("div");
  row.className = `message-row ${isOutgoing ? "outgoing" : "incoming"}`;
  row.dataset.id = msg.messageId;
  row._msg = msg;

  const senderName = isOutgoing ? currentUser.name : findUserName(msg.senderId);

  if (!isOutgoing) {
    const senderAvatar = document.createElement("div");
    senderAvatar.className = "message-avatar";
    setAvatar(senderAvatar, senderName);
    row.appendChild(senderAvatar);
  }

  const content = document.createElement("div");
  content.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isPending ? "pending" : ""}`;

  if (!isOutgoing && activeTarget?.type === "group") {
    const label = document.createElement("div");
    label.className = "sender-label";
    label.style.color = getAvatarColor(senderName);
    label.textContent = senderName;
    bubble.appendChild(label);
  }

  const text = document.createElement("div");
  text.className = "bubble-text";
  text.textContent = msg.text;

  const meta = document.createElement("div");
  meta.className = "bubble-meta";

  if (msg.editedAt) {
    const editedSpan = document.createElement("span");
    editedSpan.className = "edited-indicator";
    editedSpan.textContent = "(edited)";
    meta.appendChild(editedSpan);
  }

  const time = document.createElement("span");
  time.textContent = isPending ? "Sending..." : formatTime(msg.createdAt);
  meta.appendChild(time);

  if (isOutgoing) {
    const status = document.createElement("span");
    status.className = `status-check ${readInfo.isRead ? "read" : ""}`;
    status.textContent = isPending ? "🕒" : readInfo.isRead ? "✓✓" : "✓";
    status.title = readInfo.title || "";
    meta.appendChild(status);
  }

  bubble.appendChild(text);
  bubble.appendChild(meta);
  content.appendChild(bubble);

  if (isOutgoing && !isPending) {
    attachActions(content, row);
  }

  row.appendChild(content);
  return row;
}

async function onEditMessage(msg) {
  const newText = prompt("Edit your message:", msg.text);
  if (!newText || !newText.trim() || newText.trim() === msg.text) return;

  const trimmed = newText.trim();
  const targetChatId = activeChatId;
  const session = currentChatSession;
  const row = messagesContainer.querySelector(`[data-id="${msg.messageId}"]`);
  const actionsEl = row?.querySelector(".message-actions");
  if (actionsEl) actionsEl.style.pointerEvents = "none";

  try {
    const updated = await api("PATCH", `/chat/${targetChatId}/message/${msg.messageId}`, {
      userId: currentUser.id,
      text: trimmed
    });
    if (session !== currentChatSession) return;

    msg.text = updated.text;
    msg.editedAt = updated.editedAt;

    if (row) {
      row._msg = msg;
      const textEl = row.querySelector(".bubble-text");
      if (textEl) textEl.textContent = updated.text;
      let editedSpan = row.querySelector(".edited-indicator");
      if (!editedSpan) {
        editedSpan = document.createElement("span");
        editedSpan.className = "edited-indicator";
        editedSpan.textContent = "(edited)";
        const meta = row.querySelector(".bubble-meta");
        if (meta) meta.prepend(editedSpan);
      }
    }
    await loadMessages(session, false);
  } catch (err) {
    alert("Failed to edit: " + err.message);
  } finally {
    if (actionsEl) actionsEl.style.pointerEvents = "";
  }
}

async function onDeleteMessage(msg) {
  if (!confirm("Delete this message?")) return;

  const targetChatId = activeChatId;
  const session = currentChatSession;
  const row = messagesContainer.querySelector(`[data-id="${msg.messageId}"]`);
  const actionsEl = row?.querySelector(".message-actions");
  if (actionsEl) actionsEl.style.pointerEvents = "none";

  try {
    await api("DELETE", `/chat/${targetChatId}/message/${msg.messageId}?userId=${currentUser.id}`);
    if (session !== currentChatSession) return;
    if (row) row.remove();
    await loadMessages(session, false);
  } catch (err) {
    alert("Failed to delete: " + err.message);
  } finally {
    if (actionsEl) actionsEl.style.pointerEvents = "";
  }
}

function renderBatchMessages(messages, forceScroll = false) {
  const currentRows = new Map();
  messagesContainer.querySelectorAll(".message-row").forEach((el) => {
    currentRows.set(el.dataset.id, el);
  });

  let unreadIncoming = null;

  messages.forEach((msg) => {
    const isOutgoing = msg.senderId === currentUser.id;
    const readInfo = getReadInfo(msg, isOutgoing);
    const existing = currentRows.get(msg.messageId);

    if (!existing) {
      const row = renderMessageRow(msg, isOutgoing, readInfo, false);
      messagesContainer.appendChild(row);
    } else {
      existing._msg = msg;
      const textEl = existing.querySelector(".bubble-text");
      if (textEl && textEl.textContent !== msg.text) {
        textEl.textContent = msg.text;
      }
      let editedSpan = existing.querySelector(".edited-indicator");
      if (msg.editedAt && !editedSpan) {
        editedSpan = document.createElement("span");
        editedSpan.className = "edited-indicator";
        editedSpan.textContent = "(edited)";
        const meta = existing.querySelector(".bubble-meta");
        if (meta) meta.prepend(editedSpan);
      }

      if (isOutgoing) {
        const status = existing.querySelector(".status-check");
        if (status) {
          status.className = `status-check ${readInfo.isRead ? "read" : ""}`;
          status.textContent = readInfo.isRead ? "✓✓" : "✓";
          status.title = readInfo.title || "";
        }
        const time = existing.querySelector(".bubble-meta span:not(.edited-indicator)");
        if (time && time.textContent === "Sending...") {
          time.textContent = formatTime(msg.createdAt);
        }
        const content = existing.querySelector(".message-content");
        if (content && !content.querySelector(".message-actions")) {
          attachActions(content, existing);
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

  currentRows.forEach((row, id) => {
    if (!id.startsWith("temp-")) {
      row.remove();
    }
  });

  if (unreadIncoming && activeChatId) {
    markedReadIds.add(unreadIncoming.messageId);
    api("POST", `/chat/${activeChatId}/message/${unreadIncoming.messageId}/read`, {
      userId: currentUser.id
    }).catch(() => {});
    api("POST", `/chat/${activeChatId}/lastseen`, {
      userId: currentUser.id,
      messageId: unreadIncoming.messageId
    }).catch(() => {});
  }

  if (forceScroll) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function clearSidebarActive() {
  document.querySelectorAll(".contact-item").forEach((it) => it.classList.remove("active"));
}

async function openDmChat(contact) {
  const session = ++currentChatSession;
  activeTarget = { type: "dm", contact };
  localStorage.setItem("chat_active_type", "dm");
  localStorage.setItem("chat_active_target_id", contact.id);

  setAvatar(activeAvatar, contact.name);
  activeName.textContent = contact.name || "User";
  activeStatus.textContent = "Active now";
  manageGroupBtn.classList.add("hidden");

  clearSidebarActive();
  const clicked = contactList.querySelector(`[data-user-id="${contact.id}"]`);
  if (clicked) clicked.classList.add("active");

  emptyState.classList.add("hidden");
  chatView.classList.remove("hidden");

  const cachedChatId = localStorage.getItem(`chat_id_${currentUser.id}_${contact.id}`);
  if (cachedChatId) {
    activeChatId = cachedChatId;
    const rawCache = localStorage.getItem(`msgs_${cachedChatId}`);
    if (rawCache) {
      try {
        messagesContainer.innerHTML = "";
        renderBatchMessages(JSON.parse(rawCache), true);
      } catch {}
    }
  } else {
    messagesContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Loading messages...</div>`;
  }

  try {
    const chat = await api("POST", "/chat/create", {
      userAId: currentUser.id,
      userBId: contact.id
    });
    if (session !== currentChatSession) return;
    activeChatId = chat.chatId;
    localStorage.setItem(`chat_id_${currentUser.id}_${contact.id}`, chat.chatId);

    if (!cachedChatId) {
      messagesContainer.innerHTML = "";
    }
    await loadMessages(session, true);
    messageInput.focus();
  } catch (err) {
    if (session !== currentChatSession) return;
    messagesContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Could not load chat: ${err.message}</div>`;
  }
}

async function openGroupChat(group) {
  const session = ++currentChatSession;
  activeTarget = { type: "group", group };
  activeChatId = group.chatId;
  localStorage.setItem("chat_active_type", "group");
  localStorage.setItem("chat_active_target_id", group.chatId);

  setAvatar(activeAvatar, group.name);
  activeName.textContent = group.name || "Group";
  activeStatus.textContent = `${group.members.length} members: ${group.members.map((m) => m.name || "User").join(", ")}`;
  manageGroupBtn.classList.remove("hidden");

  clearSidebarActive();
  const clicked = groupList.querySelector(`[data-group-id="${group.chatId}"]`);
  if (clicked) clicked.classList.add("active");

  emptyState.classList.add("hidden");
  chatView.classList.remove("hidden");

  const rawCache = localStorage.getItem(`msgs_${group.chatId}`);
  if (rawCache) {
    try {
      messagesContainer.innerHTML = "";
      renderBatchMessages(JSON.parse(rawCache), true);
    } catch {}
  } else {
    messagesContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Loading messages...</div>`;
  }

  await loadMessages(session, true);
  messageInput.focus();
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
    localStorage.setItem(`msgs_${activeChatId}`, JSON.stringify(messages.slice(-50)));

    if (messagesContainer.firstChild && !messagesContainer.firstChild.classList?.contains("message-row")) {
      messagesContainer.innerHTML = "";
    }

    const isNearBottom =
      forceScroll ||
      messagesContainer.scrollHeight -
        messagesContainer.scrollTop -
        messagesContainer.clientHeight <
        120;

    renderBatchMessages(messages, isNearBottom);
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
  const tempRow = renderMessageRow(tempMsg, true, { isRead: false, title: "" }, true);
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
      tempRow._msg = sent;
      const bubble = tempRow.querySelector(".bubble");
      if (bubble) bubble.classList.remove("pending");

      const time = tempRow.querySelector(".bubble-meta span:not(.edited-indicator)");
      if (time) time.textContent = formatTime(sent.createdAt);

      const status = tempRow.querySelector(".status-check");
      if (status) {
        status.textContent = "✓";
      }

      const content = tempRow.querySelector(".message-content");
      if (content) {
        attachActions(content, tempRow);
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

function showGroupModal() {
  groupNameInput.value = "";
  groupMemberOptions.innerHTML = "";
  const others = allUsers.filter((u) => u.id !== currentUser?.id);

  others.forEach((u) => {
    const row = document.createElement("label");
    row.className = "group-checkbox-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = u.id;
    cb.addEventListener("change", () => {
      const checked = groupMemberOptions.querySelectorAll("input:checked");
      groupMemberOptions.querySelectorAll("input:not(:checked)").forEach((box) => {
        box.disabled = checked.length >= 2;
      });
    });

    const av = document.createElement("div");
    av.className = "avatar";
    av.style.width = "28px";
    av.style.height = "28px";
    av.style.fontSize = "0.75rem";
    setAvatar(av, u.name);

    const span = document.createElement("span");
    span.textContent = u.name;

    row.appendChild(cb);
    row.appendChild(av);
    row.appendChild(span);
    groupMemberOptions.appendChild(row);
  });

  groupModal.classList.remove("hidden");
  setTimeout(() => groupNameInput.focus(), 50);
}

newGroupBtn.addEventListener("click", showGroupModal);
groupModalCloseBtn.addEventListener("click", () => groupModal.classList.add("hidden"));

createGroupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = groupNameInput.value.trim();
  const selectedIds = [...groupMemberOptions.querySelectorAll("input:checked")].map((cb) => cb.value);

  if (!name || selectedIds.length === 0) {
    alert("Please enter a group name and select at least 1 other person.");
    return;
  }

  try {
    const group = await api("POST", "/chat/group/create", {
      name,
      memberIds: [currentUser.id, ...selectedIds]
    });
    groupModal.classList.add("hidden");
    await loadSidebar();
    await openGroupChat(group);
  } catch (err) {
    alert("Failed to create group: " + err.message);
  }
});

function showManageGroupModal() {
  if (activeTarget?.type !== "group") return;
  const group = activeTarget.group;
  renameGroupInput.value = group.name || "";

  manageMembersList.innerHTML = "";
  group.members.forEach((m) => {
    const row = document.createElement("div");
    row.className = "member-row";

    const info = document.createElement("div");
    info.className = "member-info";

    const av = document.createElement("div");
    av.className = "avatar";
    av.style.width = "28px";
    av.style.height = "28px";
    av.style.fontSize = "0.75rem";
    setAvatar(av, m.name);

    const span = document.createElement("span");
    span.textContent = m.name + (m.id === currentUser.id ? " (you)" : "");

    info.appendChild(av);
    info.appendChild(span);
    row.appendChild(info);

    if (group.members.length > 2 || m.id === currentUser.id) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-remove";
      btn.textContent = m.id === currentUser.id ? "Leave" : "Remove";
      btn.addEventListener("click", async () => {
        try {
          const updated = await api("DELETE", `/chat/${group.chatId}/members/${m.id}?userId=${currentUser.id}`);
          if (m.id === currentUser.id) {
            manageGroupModal.classList.add("hidden");
            activeTarget = null;
            activeChatId = null;
            localStorage.removeItem("chat_active_type");
            localStorage.removeItem("chat_active_target_id");
            chatView.classList.add("hidden");
            emptyState.classList.remove("hidden");
            await loadSidebar();
          } else {
            activeTarget.group = updated;
            await loadSidebar();
            activeStatus.textContent = `${updated.members.length} members: ${updated.members.map((u) => u.name).join(", ")}`;
            showManageGroupModal();
          }
        } catch (err) {
          alert(err.message);
        }
      });
      row.appendChild(btn);
    }

    manageMembersList.appendChild(row);
  });

  const nonMembers = allUsers.filter((u) => !group.memberIds.includes(u.id));
  if (group.members.length < 3 && nonMembers.length > 0) {
    addMemberSection.classList.remove("hidden");
    addMemberSelect.innerHTML = "";
    nonMembers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.name;
      addMemberSelect.appendChild(opt);
    });
  } else {
    addMemberSection.classList.add("hidden");
  }

  manageGroupModal.classList.remove("hidden");
}

manageGroupBtn.addEventListener("click", showManageGroupModal);
manageModalCloseBtn.addEventListener("click", () => manageGroupModal.classList.add("hidden"));

renameGroupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (activeTarget?.type !== "group") return;
  const name = renameGroupInput.value.trim();
  if (!name) return;

  try {
    const updated = await api("PATCH", `/chat/${activeTarget.group.chatId}`, {
      userId: currentUser.id,
      name
    });
    activeTarget.group = updated;
    activeName.textContent = updated.name;
    setAvatar(activeAvatar, updated.name);
    await loadSidebar();
    manageGroupModal.classList.add("hidden");
  } catch (err) {
    alert(err.message);
  }
});

addMemberBtn.addEventListener("click", async () => {
  if (activeTarget?.type !== "group") return;
  const memberId = addMemberSelect.value;
  if (!memberId) return;

  try {
    const updated = await api("POST", `/chat/${activeTarget.group.chatId}/members`, {
      userId: currentUser.id,
      memberId
    });
    activeTarget.group = updated;
    await loadSidebar();
    activeStatus.textContent = `${updated.members.length} members: ${updated.members.map((u) => u.name).join(", ")}`;
    showManageGroupModal();
  } catch (err) {
    alert(err.message);
  }
});

async function init() {
  const data = await api("GET", "/users");
  const users = data.users || [];
  const storedId = localStorage.getItem("chat_user_id");
  const matched = users.find((u) => u.id === storedId);

  let sidebar = { users: [], groups: [] };
  if (matched) {
    sidebar = await setCurrentUser(matched);
  } else if (users.length > 0) {
    sidebar = await setCurrentUser(users[0]);
  } else {
    showUserModal();
  }

  const savedType = localStorage.getItem("chat_active_type");
  const savedTargetId = localStorage.getItem("chat_active_target_id");

  if (savedType === "group" && savedTargetId) {
    const group = sidebar.groups.find((g) => g.chatId === savedTargetId);
    if (group) await openGroupChat(group);
  } else if (savedType === "dm" && savedTargetId) {
    const contact = sidebar.users.find((u) => u.id === savedTargetId);
    if (contact) await openDmChat(contact);
  }

  setInterval(async () => {
    if (isPolling) return;
    isPolling = true;
    pollCount += 1;
    try {
      if (activeChatId) {
        await loadMessages(currentChatSession, false);
      }
      if (pollCount % 3 === 0 && currentUser) {
        await loadSidebar();
        if (activeTarget?.type === "group") {
          const freshGroup = userGroups.find((g) => g.chatId === activeTarget.group.chatId);
          if (freshGroup) {
            activeTarget.group = freshGroup;
            activeName.textContent = freshGroup.name;
            activeStatus.textContent = `${freshGroup.members.length} members: ${freshGroup.members.map((m) => m.name || "User").join(", ")}`;
          }
        }
      }
    } finally {
      isPolling = false;
    }
  }, 900);
}

init().catch((err) => console.error(err));
