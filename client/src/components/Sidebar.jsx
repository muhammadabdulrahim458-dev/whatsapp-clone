import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import NewConversationModal from "./NewConversationModal";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

const Sidebar = ({
  conversations,
  activeConversation,
  setActiveConversation,
  refreshConversations,
}) => {
  const { user, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // Helper to format timestamp (e.g., "10:45 AM")
  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Get avatar URL or initials fallback
  const getAvatar = (u) =>
    u?.avatar
      ? `${API}${u.avatar}`
      : `https://ui-avatars.com/api/?name=${u?.username || "User"}&background=random`;

  // Render a conversation item
  const renderConversation = (conv) => {
    const isGroup = conv.isGroup;
    const participants = conv.participants || [];

    // For one-on-one: find the other user
    const otherUser = !isGroup
      ? participants.find((p) => p._id !== user._id) || participants[0]
      : null;

    // Name
    const name = isGroup ? conv.groupName : otherUser?.username || "Unknown";

    // Avatar source
    const avatarSrc = isGroup
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
          conv.groupName || "Group",
        )}&background=random`
      : getAvatar(otherUser);

    // Last message preview
    const lastMsg = conv.lastMessage;
    const lastMsgText = lastMsg
      ? lastMsg.text.length > 25
        ? lastMsg.text.slice(0, 25) + "..."
        : lastMsg.text
      : "No messages yet";

    const isActive = activeConversation?._id === conv._id;

    return (
      <div
        key={conv._id}
        onClick={() => setActiveConversation(conv)}
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors duration-150 border-b border-gray-200 hover:bg-gray-100 ${
          isActive ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <img
            src={avatarSrc}
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
          {/* Online dot (optional, can add later) */}
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-gray-400" />
        </div>

        {/* Conversation info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {name}
            </h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatTime(lastMsg?.createdAt)}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">{lastMsgText}</p>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar container */}
      <div className="w-1/3 h-full flex flex-col bg-white border-r border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <img
              src={getAvatar(user)}
              alt={user?.username}
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="font-semibold text-gray-800">
              {user?.username}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full transition-colors"
              title="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-gray-700"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-gray-700"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-center text-gray-500 mt-10">
              No conversations yet
            </p>
          )}
          {conversations.map(renderConversation)}
        </div>
      </div>

      {/* New conversation modal */}
      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onConversationCreated={(newConv) => {
            refreshConversations();
            setActiveConversation(newConv);
          }}
        />
      )}
    </>
  );
};

export default Sidebar;
