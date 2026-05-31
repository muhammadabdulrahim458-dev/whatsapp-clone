// server/repositories/conversation.repository.js
const Conversation = require('../models/Conversation.model');

class ConversationRepository {
  async findById(id, populateFields = []) {
    let query = Conversation.findById(id);
    if (populateFields.includes('participants')) {
      query = query.populate('participants', 'username email avatar');
    }
    if (populateFields.includes('groupAdmin')) {
      query = query.populate('groupAdmin', 'username email avatar');
    }
    if (populateFields.includes('lastMessage')) {
      query = query.populate('lastMessage');
    }
    return await query;
  }

  async findUserConversations(userId) {
    return await Conversation.find({ participants: userId })
      .populate('participants', 'username email avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
  }

  async findOnePrivateConversation(userId1, userId2) {
    return await Conversation.findOne({
      isGroup: false,
      participants: { $all: [userId1, userId2] }
    }).populate('participants', 'username email avatar');
  }

  async createPrivateConversation(participantIds) {
    const conversation = new Conversation({
      participants: participantIds,
      isGroup: false
    });
    await conversation.save();
    return await conversation.populate('participants', 'username email avatar');
  }

  async createGroupConversation(participantIds, groupName, adminId) {
    const conversation = new Conversation({
      participants: participantIds,
      isGroup: true,
      groupName,
      groupAdmin: adminId
    });
    await conversation.save();
    return await conversation.populate('participants', 'username email avatar');
  }

  async updateLastMessage(conversationId, messageId) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessage: messageId },
      { new: true }
    );
  }

  async updateGroupName(conversationId, newName) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { groupName: newName },
      { new: true }
    );
  }

  async updateGroupAdmin(conversationId, newAdminId) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { groupAdmin: newAdminId },
      { new: true }
    );
  }

  async addParticipants(conversationId, userIds) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { participants: { $each: userIds } } },
      { new: true }
    );
  }

  async removeParticipant(conversationId, userId) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: userId } },
      { new: true }
    );
  }

  async deleteConversation(conversationId) {
    return await Conversation.findByIdAndDelete(conversationId);
  }

  async checkUserInConversation(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId).select('participants');
    return conversation?.participants.some(p => p.toString() === userId.toString()) || false;
  }
}

module.exports = new ConversationRepository();