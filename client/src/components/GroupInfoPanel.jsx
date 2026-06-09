import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const API = "http://localhost:5000";

const GroupInfoPanel = ({ conversation, onClose, onlineUsers }) => {
  const { user, token } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });

  // Add Member Feature States
  const [showAddMemberSection, setShowAddMemberSection] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedNewUsers, setSelectedNewUsers] = useState([]);

  const isAdmin = group?.groupAdmin?._id === user._id;

  const fetchGroupInfo = async () => {
    if (!conversation?._id) return;
    try {
      const res = await fetch(`${API}/api/chat/group/${conversation._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setGroup(data.data);
        setNewName(data.data.groupName);
      }
    } catch (err) {
      console.error("Error fetching group info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchGroupInfo();
    // Reset local view states when switching conversations
    setShowAddMemberSection(false);
    setSelectedNewUsers([]);
    setMemberSearchQuery("");
  }, [conversation?._id]);

  // Fetch all registered platform users to select from for adding
  useEffect(() => {
    if (!showAddMemberSection) return;

    const fetchAllUsers = async () => {
      try {
        const res = await fetch(`${API}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllUsers(data);
        } else if (data.success && Array.isArray(data.data)) {
          setAllUsers(data.data);
        }
      } catch (err) {
        console.error("Error fetching users list:", err);
      }
    };

    fetchAllUsers();
  }, [showAddMemberSection, token]);

  const changeName = async () => {
    if (!newName.trim() || newName === group?.groupName) {
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(
        `${API}/api/chat/group/${conversation._id}/name`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newName }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setGroup({ ...group, groupName: newName });
        setEditingName(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedNewUsers.length === 0) return;
    try {
      const res = await fetch(`${API}/api/chat/group/${conversation._id}/add`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: selectedNewUsers }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setSelectedNewUsers([]);
        setShowAddMemberSection(false);
        fetchGroupInfo();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectUserForAddition = (userId) => {
    setSelectedNewUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const removeMember = async (userId) => {
    try {
      const res = await fetch(
        `${API}/api/chat/group/${conversation._id}/remove`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        },
      );
      await res.json();
      fetchGroupInfo();
    } catch (err) {
      console.error(err);
    }
  };

  const leaveGroup = async () => {
    try {
      await fetch(`${API}/api/chat/group/${conversation._id}/leave`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      onClose();
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearGroupChat = () => {
    setConfirmModal({
      show: true,
      message:
        "Clear all messages in this group? This action cannot be undone.",
      onConfirm: async () => {
        setClearing(true);
        try {
          const res = await fetch(
            `${API}/api/chat/conversations/${conversation._id}/messages`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const data = await res.json();
          if (data.success) {
            onClose();
          } else {
            alert(data.message || "Failed to clear messages");
          }
        } catch (err) {
          console.error(err);
          alert("Failed to clear chat");
        } finally {
          setClearing(false);
          setConfirmModal({ show: false, message: "", onConfirm: null });
        }
      },
    });
  };

  // Filter out existing participants from the search pool selection
  const nonGroupMembers = allUsers.filter(
    (u) => !group?.participants?.some((p) => p._id === u._id),
  );

  const filteredSearchUsers = nonGroupMembers.filter((u) =>
    u.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()),
  );

  if (!conversation || !conversation.isGroup) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop overlay */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          onClick={onClose}
        />

        <div className="w-80 h-full bg-white shadow-2xl flex flex-col relative z-50 animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-bold text-lg">Group Info</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black transition"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading details...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              {/* Group Avatar & Name */}
              <div className="flex flex-col items-center border-b pb-4">
                <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-md">
                  {group?.groupName?.[0]?.toUpperCase() || "G"}
                </div>
                {editingName ? (
                  <div className="flex flex-col gap-2 w-full px-2">
                    <input
                      className="border p-2 rounded text-sm w-full focus:outline-indigo-500"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingName(false)}
                        className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-100 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={changeName}
                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xl text-gray-800">
                      {group?.groupName}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Members List */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Members ({group?.participants?.length || 0})
                </h3>
                <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto pr-1">
                  {group?.participants?.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={
                              p.avatar
                                ? `${API}${p.avatar}`
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username)}&background=random`
                            }
                            className="w-9 h-9 rounded-full object-cover shadow-xs"
                            alt={p.username}
                          />
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              onlineUsers.has(p._id)
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700">
                            {p.username}
                          </span>
                          {p._id === group?.groupAdmin?._id && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-1.5 py-0.5 rounded w-max mt-0.5">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdmin && p._id !== user._id && (
                        <button
                          onClick={() => removeMember(p._id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add members Panel (Admin Only Access) */}
              {isAdmin && (
                <div className="border-t pt-4">
                  {!showAddMemberSection ? (
                    <button
                      onClick={() => setShowAddMemberSection(true)}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition"
                    >
                      <span className="text-lg">+</span> Add Members
                    </button>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">
                          Select Users
                        </h4>
                        <button
                          onClick={() => setShowAddMemberSection(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Search workspace users..."
                        className="w-full text-xs border rounded p-2 mb-2 bg-white focus:outline-indigo-500"
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                      />

                      <div className="max-h-36 overflow-y-auto mb-3 flex flex-col gap-1 pr-1">
                        {filteredSearchUsers.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">
                            No dynamic users available
                          </p>
                        ) : (
                          filteredSearchUsers.map((u) => (
                            <label
                              key={u._id}
                              className="flex items-center justify-between p-1.5 hover:bg-white rounded cursor-pointer transition text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <img
                                  src={
                                    u.avatar
                                      ? `${API}${u.avatar}`
                                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random`
                                  }
                                  className="w-6 h-6 rounded-full"
                                  alt=""
                                />
                                <span className="text-gray-700 font-medium">
                                  {u.username}
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedNewUsers.includes(u._id)}
                                onChange={() =>
                                  toggleSelectUserForAddition(u._id)
                                }
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                            </label>
                          ))
                        )}
                      </div>

                      <button
                        onClick={handleAddMembersSubmit}
                        disabled={selectedNewUsers.length === 0}
                        className="w-full bg-indigo-600 text-white text-xs py-2 rounded font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                      >
                        Add Selected ({selectedNewUsers.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Operations Area */}
              <div className="mt-auto border-t pt-4 flex flex-col gap-3">
                <button
                  onClick={handleClearGroupChat}
                  disabled={clearing}
                  className="w-full bg-red-50 text-red-600 py-2.5 rounded-lg font-medium text-sm hover:bg-red-100 transition disabled:opacity-50"
                >
                  {clearing
                    ? "Clearing Storage..."
                    : "Clear Conversation Content"}
                </button>

                <button
                  onClick={leaveGroup}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 transition text-center"
                >
                  Leave Group Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Confirmation Modal overlay portal wrapper */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-2xl scale-in-95 duration-150">
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              Are you absolutely sure?
            </h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setConfirmModal({ show: false, message: "", onConfirm: null })
                }
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroupInfoPanel;
