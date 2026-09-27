'use strict';

const messageState = { conversations: [], contacts: [], activeId: null, activeMessages: [], search: '', contactSearch: '', loaded: false, groupMode: false, selectedContactIds: new Set() };
function messageTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function conversationName(conversation) {
  if (conversation.title) return conversation.title;
  const other = (conversation.members || []).find((member) => String(member.id) !== String(currentUser && currentUser.id));
  return other ? other.name : 'Conversation';
}
function conversationOtherId(conversation) {
  const other = (conversation.members || []).find((member) => String(member.id) !== String(currentUser && currentUser.id));
  return other ? String(other.id) : null;
}
function presenceMarkup(userId) {
  return presenceUsers.has(String(userId)) ? '<i></i>' : '<i class="offline"></i>';
}
function conversationInitials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}
function renderMessagesList() {
  const list = qs('#messagesList');
  if (!list) return;
  const search = messageState.search.toLowerCase();
  const conversations = messageState.conversations.filter((conversation) => `${conversationName(conversation)} ${conversation.last_message || ''}`.toLowerCase().includes(search));
  list.innerHTML = conversations.length ? conversations.map((conversation, index) => {
    const name = conversationName(conversation);
    const color = ['blue', 'violet', 'green'][index % 3];
    return `<button type="button" class="message-row" onclick="openConversation('${conversation.id}')"><span class="message-avatar ${color}">${escapeHtml(conversationInitials(name))}${conversationOtherId(conversation) ? presenceMarkup(conversationOtherId(conversation)) : ''}</span><span class="message-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(conversation.last_message || 'Start the conversation')}</small></span><time>${escapeHtml(messageTime(conversation.last_message_at))}</time>${conversation.unread_count ? `<b>${conversation.unread_count > 9 ? '9+' : conversation.unread_count}</b>` : ''}</button>`;
  }).join('') : '<div class="messages-empty"><i class="fa-regular fa-comments text-2xl opacity-50"></i><p class="mt-2 font-semibold">No conversations yet</p><p class="mt-1">Start a conversation with a classmate or campus user.</p></div>';
}
function renderMessagesOnline() {
  const wrap = qs('#messagesOnline');
  if (!wrap) return;
  const contacts = messageState.contacts.slice(0, 6);
  wrap.innerHTML = contacts.length ? contacts.map((contact, index) => `<button type="button" class="flex shrink-0 flex-col items-center gap-1.5" onclick="startConversation('${contact.id}')"><span class="message-avatar ${['blue', 'violet', 'green'][index % 3]}">${escapeHtml(conversationInitials(contact.name))}${presenceMarkup(contact.id)}</span><span class="w-14 truncate text-center text-[10px] font-semibold text-inksoft dark:text-inksoft-dark">${escapeHtml(contact.name.split(/\s+/)[0])}</span></button>`).join('') : '<p class="text-xs text-inksoft dark:text-inksoft-dark">No other Eduflow users found yet.</p>';
}
function renderMessageContacts() {
  const wrap = qs('#messagesContacts');
  if (!wrap) return;
  const search = messageState.contactSearch.toLowerCase();
  const contacts = messageState.contacts.filter((contact) => `${contact.name} ${contact.email}`.toLowerCase().includes(search));
  wrap.innerHTML = contacts.length ? contacts.map((contact, index) => messageState.groupMode
    ? `<label class="message-contact-check"><input type="checkbox" value="${contact.id}" ${messageState.selectedContactIds.has(String(contact.id)) ? 'checked' : ''} onchange="toggleGroupMember('${contact.id}', this.checked)" /><span class="message-avatar ${['blue', 'violet', 'green'][index % 3]}">${escapeHtml(conversationInitials(contact.name))}${presenceMarkup(contact.id)}</span><span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.email)}${contact.department ? ` · ${escapeHtml(contact.department)}` : ''}</small></span></label>`
    : `<button type="button" class="messages-contact-row" onclick="startConversation('${contact.id}')"><span class="message-avatar ${['blue', 'violet', 'green'][index % 3]}">${escapeHtml(conversationInitials(contact.name))}${presenceMarkup(contact.id)}</span><span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.email)}${contact.department ? ` · ${escapeHtml(contact.department)}` : ''}</small></span></button>`).join('') : '<div class="messages-empty">No matching users found.</div>';
}
function renderMessageThread() {
  const conversation = messageState.conversations.find((item) => String(item.id) === String(messageState.activeId));
  const thread = qs('#messagesThreadPanel');
  if (!thread || !conversation) return;
  const name = conversationName(conversation);
  qs('#messagesThreadName').textContent = name;
  qs('#messagesThreadStatus').textContent = `${conversation.kind === 'group' ? 'Group' : 'Direct'} conversation`;
  qs('#messagesThreadAvatar span').textContent = conversationInitials(name);
  qs('#messagesThreadList').innerHTML = messageState.activeMessages.length ? messageState.activeMessages.map((message) => {
    const mine = String(message.sender_id) === String(currentUser && currentUser.id);
    return `<div class="message-bubble-row ${mine ? 'mine' : ''}"><div class="message-bubble"><p>${escapeHtml(message.body)}</p><time>${escapeHtml(mine ? 'You · ' : `${message.sender_name} · `)}${escapeHtml(messageTime(message.created_at))}</time></div></div>`;
  }).join('') : '<div class="messages-empty">No messages yet. Say hello.</div>';
  const list = qs('#messagesThreadList');
  list.scrollTop = list.scrollHeight;
}
function renderMessages() {
  renderMessagesList();
  renderMessagesOnline();
  renderMessageContacts();
  if (messageState.activeId) renderMessageThread();
  renderMobileNotifications();
}
async function loadMessageContacts() {
  try {
    const data = await apiFetch('/api/messages/contacts');
    messageState.contacts = data.contacts || [];
    renderMessages();
  } catch (err) { showToast(err.message); }
}
async function loadConversations() {
  try {
    const data = await apiFetch('/api/messages/conversations');
    messageState.conversations = data.conversations || [];
    messageState.loaded = true;
    if (messageState.activeId && !messageState.conversations.some((item) => String(item.id) === String(messageState.activeId))) messageState.activeId = null;
    renderMessages();
  } catch (err) { showToast(err.message); }
}
async function openConversation(id) {
  messageState.activeId = id;
  qs('#messagesListPanel').classList.add('hidden');
  qs('#messagesComposePanel').classList.add('hidden');
  qs('#messagesThreadPanel').classList.remove('hidden');
  try {
    const data = await apiFetch(`/api/messages/conversations/${id}/messages`);
    messageState.activeMessages = data.messages || [];
    const conversation = messageState.conversations.find((item) => String(item.id) === String(id));
    if (conversation) conversation.unread_count = 0;
    renderMessages();
  } catch (err) { showToast(err.message); }
}
function toggleGroupMember(id, selected) {
  if (selected) messageState.selectedContactIds.add(String(id));
  else messageState.selectedContactIds.delete(String(id));
}
function setMessageComposeMode(groupMode) {
  messageState.groupMode = groupMode;
  messageState.selectedContactIds = new Set();
  qs('#messagesGroupForm').classList.toggle('hidden', !groupMode);
  qs('#messagesComposeHint').textContent = groupMode ? 'Choose at least two users for your group.' : 'Choose an Eduflow user to start a direct chat.';
  qs('#messagesDirectModeBtn').classList.toggle('active', !groupMode);
  qs('#messagesGroupModeBtn').classList.toggle('active', groupMode);
  renderMessageContacts();
}
async function createGroupConversation(e) {
  e.preventDefault();
  const title = qs('#messagesGroupTitle').value.trim();
  const userIds = [...messageState.selectedContactIds].map(Number);
  if (!title || userIds.length < 2) return showToast('Add a group name and at least two members.');
  try {
    const data = await apiFetch('/api/messages/groups', { method: 'POST', body: JSON.stringify({ title, userIds }) });
    qs('#messagesGroupForm').reset();
    setMessageComposeMode(false);
    qs('#messagesComposePanel').classList.add('hidden');
    await loadConversations();
    await openConversation(data.conversationId);
  } catch (err) { showToast(err.message); }
}
function initMessageSocket() {
  if (!authToken || !window.WebSocket) return;
  const apiUrl = new URL(API_BASE);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${protocol}//${apiUrl.host}/ws/messages?token=${encodeURIComponent(authToken)}`;
  const socket = new WebSocket(socketUrl);
  socket.addEventListener('message', async (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch (e) { return; }
    if (payload.type === 'presence.snapshot') {
      presenceUsers.clear();
      (payload.userIds || []).forEach((userId) => presenceUsers.add(String(userId)));
      renderMessages();
      return;
    }
    if (payload.type === 'presence.changed') {
      if (payload.online) presenceUsers.add(String(payload.userId));
      else presenceUsers.delete(String(payload.userId));
      renderMessages();
      return;
    }
    if (payload.type === 'conversation.created') {
      await loadConversations();
      return;
    }
    if (payload.type !== 'message.created') return;
    const conversationId = String(payload.conversationId);
    if (String(messageState.activeId) === conversationId) {
      if (!messageState.activeMessages.some((message) => String(message.id) === String(payload.message.id))) messageState.activeMessages.push(payload.message);
      renderMessageThread();
      try { await apiFetch(`/api/messages/conversations/${conversationId}/messages`); } catch (e) { /* thread already rendered */ }
    }
    await loadConversations();
  });
  socket.addEventListener('close', () => { if (authToken) setTimeout(initMessageSocket, 4000); });
  window.eduflowMessageSocket = socket;
}
async function startConversation(userId) {
  try {
    const data = await apiFetch('/api/messages/conversations', { method: 'POST', body: JSON.stringify({ userId: Number(userId) }) });
    qs('#messagesComposePanel').classList.add('hidden');
    await loadConversations();
    await openConversation(data.conversationId);
  } catch (err) { showToast(err.message); }
}
async function sendMessage(e) {
  e.preventDefault();
  if (!messageState.activeId) return;
  const input = qs('#messagesInput');
  const body = input.value.trim();
  if (!body) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const data = await apiFetch(`/api/messages/conversations/${messageState.activeId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
    messageState.activeMessages.push(data.message);
    input.value = '';
    await loadConversations();
    renderMessageThread();
  } catch (err) { showToast(err.message); }
  finally { btn.disabled = false; input.focus(); }
}
