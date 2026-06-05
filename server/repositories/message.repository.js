const Message = require('../models/Message.model');

class MessageRepository {
  async create(messageData) {
    const message = new Message(messageData);
    await message.save();
    return await message.populate('sender', 'username email avatar');
  }

  async findById(id) {
    return await Message.findById(id).populate('sender', 'username email avatar');
  }

  async findByConversation(conversationId, options = {}, userId = null) {
    let query = Message.find({ conversation: conversationId });
    if (options.afterDate) {
      query = query.where('createdAt').gt(options.afterDate);
    }
    if (userId) {
      query = query.where('deletedBy').nin([userId]);
    }
    return await query.populate('sender', 'username email avatar').sort({ createdAt: 1 });
  }

  async softDeleteForUser(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message) return null;
    if (!message.deletedBy.includes(userId)) {
      message.deletedBy.push(userId);
      await message.save();
    }
    return message;
  }

  async deleteById(id) {
    return await Message.findByIdAndDelete(id);
  }

  async deleteManyByConversation(conversationId) {
    return await Message.deleteMany({ conversation: conversationId });
  }
}

module.exports = new MessageRepository();