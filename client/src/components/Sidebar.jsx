import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import NewConversationModal from "./NewConversationModal";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

const Sidebar = ({
  conversations,
  activeConversation,
  setActiveConversation,
  refreshConversations,
  unreadCounts = {},
}) => {
  const { user, token, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [openMenuConvId, setOpenMenuConvId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: "", onConfirm: null });
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuConvId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getAvatar = (u) =>
    u?.avatar
      ? `${API}${u.avatar}`
      : `https://ui-avatars.com/api/?name=${u?.username || "User"}&background=random`;

  const deleteContact = (conversationId) => {
    setConfirmModal({
      show: true,
      message: "Delete this contact? This will remove the conversation from your chat list.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/api/chat/conversations/${conversationId}/contact`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            refreshConversations();
            if (activeConversation?._id === conversationId) {
              setActiveConversation(null);
            }
          } else {
            alert(data.message);
          }
        } catch (err) {
          console.error(err);
          alert("Failed to delete contact");
        } finally {
          setConfirmModal({ show: false, message: "", onConfirm: null });
          setOpenMenuConvId(null);
        }
      },
    });
  };

  const renderConversation = (conv) => {
    const isGroup = conv.isGroup;
    const participants = conv.participants || [];
    const otherUser = !isGroup
      ? participants.find((p) => p._id !== user._id) || participants[0]
      : null;
    const name = isGroup ? conv.groupName : otherUser?.username || "Unknown";
    const avatarSrc = isGroup
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.groupName || "Group")}&background=random`
      : getAvatar(otherUser);
    const lastMsg = conv.lastMessage;
    const clearedAt = conv.clearedAt;
    let lastMsgText = "No messages yet";
    if (lastMsg && (!clearedAt || new Date(lastMsg.createdAt) > new Date(clearedAt))) {
      lastMsgText = lastMsg.text?.length > 25
        ? lastMsg.text.slice(0, 25) + "..."
        : lastMsg.text || "File";
    }
    const isActive = activeConversation?._id === conv._id;
    const unreadCount = unreadCounts[conv._id] || 0;

    return (
      <div
        key={conv._id}
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors duration-150 border-b border-gray-200 hover:bg-gray-100 ${
          isActive ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
        }`}
        onClick={() => setActiveConversation(conv)}
      >
        <div className="relative flex-shrink-0">
          <img src={avatarSrc} alt={name} className="w-12 h-12 rounded-full object-cover" />
          {/* Blue dot for unread messages, gray for read */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
              unreadCount > 0 ? "bg-blue-500" : "bg-gray-400"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{name}</h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatTime(lastMsg?.createdAt)}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">{lastMsgText}</p>
        </div>
        {!isGroup && (
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuConvId(openMenuConvId === conv._id ? null : conv._id);
              }}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full"
            >
              ⋮
            </button>
            {openMenuConvId === conv._id && (
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteContact(conv._id);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete Contact
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="w-1/3 h-full flex flex-col bg-white border-r border-gray-300">
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <img src={getAvatar(user)} alt={user?.username} className="w-10 h-10 rounded-full object-cover" />
            <span className="font-semibold text-gray-800">{user?.username}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button onClick={() => navigate("/settings")} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-700">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={logout} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && <p className="text-center text-gray-500 mt-10">No conversations yet</p>}
          {conversations.map(renderConversation)}
        </div>
      </div>

      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onConversationCreated={(newConv) => {
            refreshConversations();
            setActiveConversation(newConv);
          }}
        />
      )}

      {confirmModal.show && (
        <div
          className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-50"
          onClick={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
        >
          <div className="bg-white rounded-lg w-80 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button onClick={confirmModal.onConfirm} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;