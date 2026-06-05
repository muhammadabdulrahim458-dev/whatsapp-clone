const UserConversationState = require('../models/UserConversationState.model');

class UserConversationStateRepository {
  async getState(userId, conversationId) {
    return await UserConversationState.findOne({ user: userId, conversation: conversationId });
  }

  async setCleared(userId, conversationId, clearedAt = new Date()) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { clearedAt, unreadCount: 0, deletedAt: null },
      { upsert: true, new: true }
    );
  }

  async setDeleted(userId, conversationId, deletedAt = new Date()) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { deletedAt, clearedAt: null },
      { upsert: true, new: true }
    );
  }

  async removeDeleted(userId, conversationId) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { deletedAt: null },
      { upsert: true, new: true }
    );
  }

  async incrementUnread(userId, conversationId) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { $inc: { unreadCount: 1 } },
      { upsert: true, new: true }
    );
  }

  async resetUnread(userId, conversationId) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { unreadCount: 0 },
      { upsert: true, new: true }
    );
  }
}

module.exports = new UserConversationStateRepository();