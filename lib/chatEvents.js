/** Bridge Socket.IO broadcasts from HTTP routes (messages, uploads). */
let ioRef = null;

function setChatIo(io) {
  ioRef = io;
}

function getChatIo() {
  return ioRef;
}

function emitToConversation(conversationId, event, payload) {
  if (!ioRef || !conversationId) return;
  ioRef.to(`conv:${conversationId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${userId}`).emit(event, payload);
}

function emitMessageNew(conversationId, payload) {
  emitToConversation(conversationId, 'message:new', payload);
}

function emitConversationUpdate(userIds, payload) {
  if (!ioRef || !Array.isArray(userIds)) return;
  userIds.forEach((uid) => emitToUser(uid, 'conversation:update', payload));
}

function emitMessageRead(conversationId, payload) {
  emitToConversation(conversationId, 'message:read', payload);
}

module.exports = {
  setChatIo,
  getChatIo,
  emitToConversation,
  emitToUser,
  emitMessageNew,
  emitConversationUpdate,
  emitMessageRead
};
