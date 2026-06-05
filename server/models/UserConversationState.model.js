const mongoose = require('mongoose');

const userConversationStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  clearedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  unreadCount: { type: Number, default: 0 },   // ← added
}, { timestamps: true });

userConversationStateSchema.index({ user: 1, conversation: 1 }, { unique: true });

module.exports = mongoose.model('UserConversationState', userConversationStateSchema);