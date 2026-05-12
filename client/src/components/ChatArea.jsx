import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import GroupInfoPanel from "./GroupInfoPanel";

const API = "http://localhost:5000";

const ChatArea = ({
  conversation,
  messages,
  sendMessage,
  onlineUsers,
  typingUser,
  socket,
}) => {
  const [input, setInput] = useState("");
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Auto‑scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (socket && conversation) {
          socket.emit("stopTyping", conversation._id);
        }
      }
    };
  }, [conversation, socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (socket && conversation) {
          socket.emit("stopTyping", conversation._id);
        }
        typingTimeoutRef.current = null;
      }
      sendMessage(input.trim());
      setInput("");
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!conversation) return;

    if (!typingTimeoutRef.current) {
      socket?.emit("typing", conversation._id);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("stopTyping", conversation._id);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  if (!conversation) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-gray-100 text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-2">💬</div>
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  const isGroup = conversation.isGroup;
  const partner = isGroup
    ? null
    : conversation.participants.find((p) => p._id !== user._id);

  const headerName = isGroup
    ? conversation.groupName
    : partner?.username || "Unknown";
  const partnerOnline = partner ? onlineUsers.has(partner._id) : false;

  const getAvatarUrl = (u) => (u?.avatar ? `${API}${u.avatar}` : null);

  const renderHeaderAvatar = () => {
    if (partner) {
      return (
        <img
          src={
            getAvatarUrl(partner) ||
            `https://ui-avatars.com/api/?name=${partner.username}&background=random`
          }
          className="w-10 h-10 rounded-full object-cover"
          alt={partner.username}
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white text-lg font-semibold">
        {headerName[0]?.toUpperCase()}
      </div>
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Header – WhatsApp like */}
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            {renderHeaderAvatar()}
            {partner && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-teal-600 ${
                  partnerOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">{headerName}</h2>
            <p className="text-xs text-teal-100">
              {isGroup
                ? `${conversation.participants?.length || 0} members`
                : partnerOnline
                  ? "Online"
                  : "Offline"}
            </p>
          </div>
        </div>

        {/* Group info button – only for groups */}
        {isGroup && (
          <button
            onClick={() => setShowGroupInfo(true)}
            className="p-2 rounded-full hover:bg-teal-500 transition"
            aria-label="Group info"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Messages area – with custom scrollbar */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2] bg-opacity-50">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => {
            const isMine = msg.sender._id === user._id;
            const mood = msg.sentiment?.label || "neutral";

            // WhatsApp‑like bubble colors, but keep mood hint for received
            let bubbleClass = "bg-white text-gray-800";
            if (isMine) {
              bubbleClass = "bg-[#dcf8c5] text-gray-800"; // WhatsApp sent green
            } else if (mood === "positive") {
              bubbleClass = "bg-green-50 border-l-4 border-green-400";
            } else if (mood === "negative") {
              bubbleClass = "bg-red-50 border-l-4 border-red-400";
            } else {
              bubbleClass = "bg-white";
            }

            const sender = isMine ? user : msg.sender;

            return (
              <div
                key={msg._id}
                className={`flex mb-4 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {/* Avatar for received messages */}
                {!isMine && (
                  <div className="shrink-0 mr-2 self-end">
                    <img
                      src={
                        getAvatarUrl(sender) ||
                        `https://ui-avatars.com/api/?name=${sender.username}&background=random`
                      }
                      className="w-8 h-8 rounded-full object-cover"
                      alt={sender.username}
                    />
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${bubbleClass}`}
                >
                  {!isMine && (
                    <div className="text-xs font-semibold text-teal-700 mb-1">
                      {sender.username}
                    </div>
                  )}
                  <div className="text-sm break-words">{msg.text}</div>
                  {/* Optional timestamp – you can add msg.createdAt */}
                  <div className="text-[10px] text-gray-400 text-right mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Avatar for sent messages (optional, but consistent) */}
                {isMine && (
                  <div className="shrink-0 ml-2 self-end">
                    <img
                      src={
                        getAvatarUrl(user) ||
                        `https://ui-avatars.com/api/?name=${user.username}&background=random`
                      }
                      className="w-8 h-8 rounded-full object-cover"
                      alt={user.username}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUser && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 rounded-2xl px-4 py-2 flex items-center gap-1">
                <span className="text-sm text-gray-600">
                  {typingUser.username} is typing
                </span>
                <span className="flex gap-0.5">
                  <span
                    className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0s" }}
                  />
                  <span
                    className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area – WhatsApp style with emoji placeholder (optional) */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-100 p-3 flex items-center gap-2 border-t"
      >
        <button
          type="button"
          className="p-2 rounded-full text-gray-500 hover:bg-gray-200"
          // Optional: add emoji picker
        >
          😊
        </button>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message"
          className="flex-1 bg-white rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="p-2 rounded-full text-teal-600 hover:bg-teal-100 disabled:opacity-50"
          disabled={!input.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>

      {/* Group Info Panel (modal / side drawer) */}
      {showGroupInfo && (
        <GroupInfoPanel
          conversation={conversation}
          onClose={() => setShowGroupInfo(false)}
          onlineUsers={onlineUsers}
        />
      )}
    </div>
  );
};

export default ChatArea;
