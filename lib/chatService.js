const { prisma } = require('./prisma');
const { isUuid } = require('./ids');

async function getOrCreateDirectConversation(meId, otherId) {
  if (!isUuid(meId) || !isUuid(otherId)) {
    return { ok: false, status: 400, error: 'Invalid user id' };
  }
  if (String(meId) === String(otherId)) {
    return { ok: false, status: 400, error: 'Cannot chat with yourself' };
  }

  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, fullName: true, email: true, avatarUrl: true, role: true, status: true }
  });
  if (!other || other.status === 'DEACTIVATED') {
    return { ok: false, status: 404, error: 'User not found' };
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId: meId, leftAt: null } } },
        { participants: { some: { userId: otherId, leftAt: null } } }
      ]
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
          }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: true
        }
      }
    }
  });

  if (existing) {
    return { ok: true, conversation: mapConversationLegacy(existing, meId) };
  }

  const created = await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: meId,
      participants: {
        create: [{ userId: meId }, { userId: otherId }]
      }
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
          }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: true
        }
      }
    }
  });

  return { ok: true, conversation: mapConversationLegacy(created, meId) };
}

function mapConversationLegacy(conv, viewerId) {
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  const users = participants.map((p) => p.user).filter(Boolean);
  const me = users.find((u) => String(u.id) === String(viewerId)) || null;
  const other = users.find((u) => String(u.id) !== String(viewerId)) || users[0] || null;
  const myMeta = participants.find((p) => String(p.userId) === String(viewerId)) || {};

  const user1 = me || users[0] || null;
  const user2 = other || users[1] || users[0] || null;

  return {
    id: conv.id,
    type: conv.type,
    bookingId: conv.bookingId,
    createdById: conv.createdById,
    title: conv.title,
    blockedAt: conv.blockedAt,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    // Legacy dual-user shape for existing frontend
    user1Id: user1 ? user1.id : null,
    user2Id: user2 ? user2.id : null,
    user1: user1
      ? {
          id: user1.id,
          fullName: user1.fullName,
          email: user1.email,
          avatar: user1.avatarUrl || null,
          role: user1.role
        }
      : null,
    user2: user2
      ? {
          id: user2.id,
          fullName: user2.fullName,
          email: user2.email,
          avatar: user2.avatarUrl || null,
          role: user2.role
        }
      : null,
    messages: (conv.messages || []).map(mapMessageLegacy),
    starredAt: myMeta.starredAt || null,
    mutedUntil: myMeta.mutedUntil || null,
    lastReadAt: myMeta.lastReadAt || null,
    participants
  };
}

function mapMessageLegacy(msg) {
  if (!msg) return null;
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    type: msg.type,
    content: msg.content,
    createdAt: msg.createdAt,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    readAt: null,
    attachments: (msg.attachments || []).map((a) => ({
      id: a.id,
      url: a.storagePath,
      mimeType: a.mimeType,
      originalName: a.originalName,
      size: a.sizeBytes
    })),
    sender: msg.sender
      ? {
          id: msg.sender.id,
          fullName: msg.sender.fullName,
          avatar: msg.sender.avatarUrl || null,
          role: msg.sender.role
        }
      : null
  };
}

async function createMessage({ conversationId, senderId, content, attachments = null, type = 'TEXT' }) {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        type: hasAttachments && !content ? 'FILE' : type,
        content: content || '',
        attachments: hasAttachments
          ? {
              create: attachments.map((a) => ({
                storagePath: String(a.url || a.storagePath || '').slice(0, 4000),
                mimeType: String(a.mimeType || 'application/octet-stream').slice(0, 120),
                originalName: a.originalName ? String(a.originalName).slice(0, 255) : null,
                sizeBytes: typeof a.size === 'number' ? a.size : Number(a.sizeBytes) || 0
              }))
            }
          : undefined
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        attachments: true
      }
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    return created;
  });

  return mapMessageLegacy(message);
}

async function unreadCount(conversationId, viewerId) {
  const meta = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: viewerId }
    },
    select: { lastReadAt: true, joinedAt: true }
  });
  if (!meta) return 0;
  const since = meta.lastReadAt || meta.joinedAt;
  return prisma.message.count({
    where: {
      conversationId,
      senderId: { not: viewerId },
      deletedAt: null,
      createdAt: { gt: since }
    }
  });
}

async function markAllRead(conversationId, viewerId) {
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: viewerId }
    },
    data: { lastReadAt: new Date() }
  });
  return 1;
}

async function setStarred(conversationId, userId, starred) {
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { starredAt: starred ? new Date() : null }
  });
}

async function setBlockedGlobal(conversationId, blocked) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { blockedAt: blocked ? new Date() : null }
  });
}

async function viewerMeta(conversationId, userId) {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { starredAt: true, mutedUntil: true, lastReadAt: true, leftAt: true }
  });
  return {
    starredAt: row?.starredAt || null,
    blockedAt: null,
    mutedUntil: row?.mutedUntil || null,
    lastReadAt: row?.lastReadAt || null
  };
}

async function isParticipant(conversationId, userId) {
  const row = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, leftAt: null },
    select: { userId: true }
  });
  return !!row;
}

module.exports = {
  getOrCreateDirectConversation,
  mapConversationLegacy,
  mapMessageLegacy,
  createMessage,
  unreadCount,
  markAllRead,
  setStarred,
  setBlockedGlobal,
  viewerMeta,
  isParticipant
};
