// server/repositories/userConversationState.repository.js
const UserConversationState = require('../models/UserConversationState.model');

class UserConversationStateRepository {
  async findOrCreate(userId, conversationId) {
    let state = await UserConversationState.findOne({ user: userId, conversation: conversationId });
    if (!state) {
      state = new UserConversationState({ user: userId, conversation: conversationId });
      await state.save();
    }
    return state;
  }

  async getState(userId, conversationId) {
    return await UserConversationState.findOne({ user: userId, conversation: conversationId });
  }

  async setCleared(userId, conversationId, clearedAt = new Date()) {
    return await UserConversationState.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { clearedAt, deletedAt: null }, // also undelete if it was deleted
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
}

module.exports = new UserConversationStateRepository();