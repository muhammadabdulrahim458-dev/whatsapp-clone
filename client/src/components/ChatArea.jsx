import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import GroupInfoPanel from "./GroupInfoPanel";
import EmojiPicker from "emoji-picker-react";

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user, token } = useAuth();
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const fileInputRef = useRef(null);

  // File upload modal state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [showFileModal, setShowFileModal] = useState(false);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState(null);

  // Dropdown, forward, clear chat, contact info
  const [openDropdownMsgId, setOpenDropdownMsgId] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [conversationsList, setConversationsList] = useState([]);
  
  // Contact info dropdown (instead of modal)
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  
  // Custom confirmation modal
  const [confirmModal, setConfirmModal] = useState({ show: false, message: "", onConfirm: null });

  // Memoize partner and online status
  const [partner, setPartner] = useState(null);
  const [partnerOnline, setPartnerOnline] = useState(false);

  // Ref for message dropdown (to detect outside clicks)
  const messageMenuRef = useRef(null);

  // Close message dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
        setOpenDropdownMsgId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (conversation) {
      const isGroup = conversation.isGroup;
      const p = isGroup ? null : conversation.participants.find((u) => u._id !== user._id);
      setPartner(p);
      setPartnerOnline(p ? onlineUsers.has(p._id) : false);
    }
  }, [conversation, user?._id, onlineUsers]);

  // Auto‑scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (socket && conversation && conversation._id) {
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
        if (socket && conversation && conversation._id) {
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

  const onEmojiClick = (emojiObject) => {
    setInput((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setFileCaption("");
    setShowFileModal(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFileWithCaption = async () => {
    if (!selectedFile || !conversation) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const uploadRes = await fetch(`${API}/api/chat/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.message);
      const { fileUrl, fileType, fileName } = uploadData.data;
      socket.emit(
        "sendFileMessage",
        {
          conversationId: conversation._id,
          fileUrl,
          fileType,
          fileName,
          text: fileCaption.trim(),
        },
        (response) => {
          if (!response.success) {
            console.error("Failed to send file message:", response.error);
            alert("Failed to send file message");
          }
          setUploading(false);
          setShowFileModal(false);
          setSelectedFile(null);
          setFileCaption("");
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file");
      setUploading(false);
      setShowFileModal(false);
    }
  };

  const openPreview = (fileUrl, fileType, fileName) => {
    setPreviewFile({ url: fileUrl, type: fileType, name: fileName });
  };

  // ------------------- NEW FUNCTIONS -------------------
  const handleDeleteMessage = async (msg) => {
    setConfirmModal({
      show: true,
      message: "Delete this message?",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/api/chat/messages/${msg._id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!data.success) alert(data.message);
          setConfirmModal({ show: false, message: "", onConfirm: null });
        } catch (err) {
          console.error(err);
          setConfirmModal({ show: false, message: "", onConfirm: null });
        }
      },
    });
  };

  const fetchConversationsForForward = async () => {
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const filtered = data.data.filter((c) => c._id !== conversation?._id);
        setConversationsList(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleForward = async (targetConvId) => {
    if (!forwardMessage) return;
    try {
      const res = await fetch(`${API}/api/chat/messages/${forwardMessage._id}/forward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetConversationId: targetConvId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForwardModal(false);
        setForwardMessage(null);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Forward failed");
    }
  };

  const handleClearChat = () => {
    setConfirmModal({
      show: true,
      message: "Clear all messages in this chat? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/api/chat/conversations/${conversation._id}/messages`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            setShowContactDropdown(false);
          } else {
            alert(data.message);
          }
          setConfirmModal({ show: false, message: "", onConfirm: null });
        } catch (err) {
          console.error(err);
          setConfirmModal({ show: false, message: "", onConfirm: null });
        }
      },
    });
  };
  // -----------------------------------------------------

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
  const headerName = isGroup ? conversation.groupName : partner?.username || "Unknown";

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

  const renderFileMessage = (msg) => {
    const { fileType, fileUrl, fileName, text } = msg;
    const fullUrl = `${API}${fileUrl}`;
    const handleDownload = (e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = fullUrl;
      link.download = fileName || "download";
      link.click();
    };
    if (fileType === "image") {
      return (
        <div>
          <img
            src={fullUrl}
            alt={fileName}
            className="max-w-full max-h-60 rounded-lg cursor-pointer"
            onClick={() => openPreview(fullUrl, "image", fileName)}
          />
          <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
            <span>{fileName}</span>
            <button onClick={handleDownload} className="text-blue-500 hover:underline text-xs">
              Download
            </button>
          </div>
          {text && <div className="text-sm mt-1">{text}</div>}
        </div>
      );
    } else if (fileType === "video") {
      return (
        <div>
          <video
            controls
            className="max-w-full max-h-60 rounded-lg cursor-pointer"
            onClick={() => openPreview(fullUrl, "video", fileName)}
          >
            <source src={fullUrl} />
          </video>
          <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
            <span>{fileName}</span>
            <button onClick={handleDownload} className="text-blue-500 hover:underline text-xs">
              Download
            </button>
          </div>
          {text && <div className="text-sm mt-1">{text}</div>}
        </div>
      );
    } else {
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📎</span>
            <a href={fullUrl} download className="text-blue-500 underline break-all" target="_blank" rel="noopener noreferrer">
              {fileName}
            </a>
            <button onClick={handleDownload} className="text-blue-500 hover:underline text-xs">
              Download
            </button>
          </div>
          {text && <div className="text-sm mt-1">{text}</div>}
        </div>
      );
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Header */}
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
        <div className="flex gap-1">
          {/* Contact info dropdown for private chats */}
          {!isGroup && partner && (
            <div className="relative">
              <button
                onClick={() => setShowContactDropdown(!showContactDropdown)}
                className="p-2 rounded-full hover:bg-teal-500 transition"
                aria-label="Contact info"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </button>
              {showContactDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20 text-gray-800">
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAvatarUrl(partner) || `https://ui-avatars.com/api/?name=${partner.username}&background=random`}
                        className="w-12 h-12 rounded-full object-cover"
                        alt={partner.username}
                      />
                      <div>
                        <p className="font-semibold">{partner.username}</p>
                        <p className="text-sm text-gray-500">{partner.email}</p>
                        <p className="text-xs text-gray-600">{partnerOnline ? "Online" : "Offline"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleClearChat}
                      className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Clear Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Group info button */}
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="p-2 rounded-full hover:bg-teal-500 transition"
              aria-label="Group info"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2] bg-opacity-50">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => {
            const isMine = msg.sender._id === user._id;
            const mood = msg.sentiment?.label || "neutral";

            let bubbleClass = "bg-white text-gray-800";
            if (isMine) {
              bubbleClass = "bg-[#dcf8c5] text-gray-800";
            } else if (mood === "positive") {
              bubbleClass = "bg-green-50 border-l-4 border-green-400";
            } else if (mood === "negative") {
              bubbleClass = "bg-red-50 border-l-4 border-red-400";
            } else {
              bubbleClass = "bg-white";
            }

            const sender = isMine ? user : msg.sender;

            return (
              <div key={msg._id} className={`flex mb-4 ${isMine ? "justify-end" : "justify-start"}`}>
                {!isMine && (
                  <div className="shrink-0 mr-2 self-end">
                    <img
                      src={getAvatarUrl(sender) || `https://ui-avatars.com/api/?name=${sender.username}&background=random`}
                      className="w-8 h-8 rounded-full object-cover"
                      alt={sender.username}
                    />
                  </div>
                )}

                <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${bubbleClass} relative group`}>
                  {!isMine && <div className="text-xs font-semibold text-teal-700 mb-1">{sender.username}</div>}
                  {msg.fileUrl ? (
                    renderFileMessage(msg)
                  ) : (
                    <div className="text-sm break-words">{msg.text}</div>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {msg.isForwarded && <span className="text-xs text-gray-400">↪️</span>}
                    <div className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {/* Dropdown menu button with outside-click detection */}
                  <div ref={messageMenuRef} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownMsgId(openDropdownMsgId === msg._id ? null : msg._id);
                      }}
                      className="bg-gray-200 rounded-full p-1 text-gray-600 hover:bg-gray-300"
                    >
                      ⋮
                    </button>
                    {openDropdownMsgId === msg._id && (
                      <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-20 min-w-32">
                        {isMine && (
                          <button
                            onClick={() => {
                              handleDeleteMessage(msg);
                              setOpenDropdownMsgId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                          >
                            Delete
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setForwardMessage(msg);
                            fetchConversationsForForward();
                            setShowForwardModal(true);
                            setOpenDropdownMsgId(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >
                          Forward
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isMine && (
                  <div className="shrink-0 ml-2 self-end">
                    <img
                      src={getAvatarUrl(user) || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                      className="w-8 h-8 rounded-full object-cover"
                      alt={user.username}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {typingUser && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 rounded-2xl px-4 py-2 flex items-center gap-1">
                <span className="text-sm text-gray-600">{typingUser.username} is typing</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                  <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="bg-gray-100 p-3 flex items-center gap-2 border-t relative">
        <div className="relative">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200">
            😊
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-50">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading ? "⏳" : "📎"}
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message"
          className="flex-1 bg-white rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button type="submit" className="p-2 rounded-full text-teal-600 hover:bg-teal-100 disabled:opacity-50" disabled={!input.trim()}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>

      {/* File caption modal */}
      {showFileModal && (
        <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-96 p-4">
            <h3 className="text-lg font-semibold mb-2">Add a caption (optional)</h3>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows="3"
              placeholder="Say something about this file..."
              value={fileCaption}
              onChange={(e) => setFileCaption(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowFileModal(false); setSelectedFile(null); setFileCaption(""); }} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                Cancel
              </button>
              <button onClick={uploadFileWithCaption} disabled={uploading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                {uploading ? "Uploading..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-96 p-4">
            <h3 className="text-lg font-semibold mb-2">Forward to...</h3>
            <div className="max-h-60 overflow-y-auto">
              {conversationsList.length === 0 && <p className="text-gray-500">No other conversations</p>}
              {conversationsList.map((conv) => {
                const otherUser = conv.isGroup ? null : conv.participants.find((p) => p._id !== user._id);
                const name = conv.isGroup ? conv.groupName : otherUser?.username;
                return (
                  <div
                    key={conv._id}
                    onClick={() => handleForward(conv._id)}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-b"
                  >
                    {name}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowForwardModal(false)} className="px-4 py-2 bg-gray-200 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal for images/videos */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewFile(null)} className="absolute top-2 right-2 text-white text-3xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center">
              ×
            </button>
            {previewFile.type === "image" ? (
              <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[80vh] object-contain" />
            ) : (
              <video controls className="max-w-full max-h-[80vh]">
                <source src={previewFile.url} />
              </video>
            )}
            <div className="mt-4 flex justify-center">
              <a href={previewFile.url} download={previewFile.name} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Download {previewFile.name}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirmation modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-80 p-4">
            <p className="mb-4">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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