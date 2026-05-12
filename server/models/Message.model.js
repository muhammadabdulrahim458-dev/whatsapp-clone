const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sentiment: {
      score: Number, // e.g. 2, -1, 0
      label: {
        // 'positive', 'negative', 'neutral'
        type: String,
        enum: ["positive", "negative", "neutral"],
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
