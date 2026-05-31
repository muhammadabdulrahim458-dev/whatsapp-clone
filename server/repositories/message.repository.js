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

  async findByConversation(conversationId, options = {}) {
    let query = Message.find({ conversation: conversationId });
    if (options.afterDate) {
      query = query.where('createdAt').gt(options.afterDate);
    }
    return await query.populate('sender', 'username email avatar').sort({ createdAt: 1 });
  }

  async deleteById(id) {
    return await Message.findByIdAndDelete(id);
  }

  async deleteManyByConversation(conversationId) {
    return await Message.deleteMany({ conversation: conversationId });
  }
}

module.exports = new MessageRepository();