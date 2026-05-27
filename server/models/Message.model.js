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
      default: "",
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      enum: ["image", "video", "audio", "document"],
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sentiment: {
      score: Number,
      label: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        default: "neutral",
      },
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Add custom validation: either text or fileUrl must exist
    validate: {
      validator: function (doc) {
        return !(!doc.text && !doc.fileUrl);
      },
      message: "Message must have either text or fileUrl",
    },
  },
);

module.exports = mongoose.model("Message", messageSchema);
