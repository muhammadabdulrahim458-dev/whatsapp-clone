import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const API = "http://localhost:5000";

const GroupInfoPanel = ({ conversation, onClose, onlineUsers }) => {
  const { user, token } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);

  const isAdmin = group?.groupAdmin?._id === user._id;

  useEffect(() => {
    fetchGroupInfo();
  }, [conversation?._id]);

  const fetchGroupInfo = async () => {
    if (!conversation) return;
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const changeName = async () => {
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

  const addMembers = async (selectedUserIds) => {
    try {
      const res = await fetch(`${API}/api/chat/group/${conversation._id}/add`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      await res.json();
      fetchGroupInfo();
    } catch (err) {
      console.error(err);
    }
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
      window.location.reload(); // simple refresh to leave and update UI
    } catch (err) {
      console.error(err);
    }
  };

  if (!conversation || !conversation.isGroup) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="w-80 h-full bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-lg">Group Info</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-center">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Group Avatar & Name */}
            <div className="flex flex-col items-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-3xl text-white mb-2">
                {group?.groupName?.[0]?.toUpperCase() || "G"}
              </div>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    className="border p-1 rounded text-sm"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <button
                    onClick={changeName}
                    className="text-blue-500 text-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{group?.groupName}</span>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-blue-500 text-sm"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Members */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Members ({group?.participants?.length})
              </h3>
              {group?.participants?.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img
                        src={
                          p.avatar
                            ? `${API}${p.avatar}`
                            : `https://ui-avatars.com/api/?name=${p.username}&background=random`
                        }
                        className="w-8 h-8 rounded-full"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${
                          onlineUsers.has(p._id)
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <span className="text-sm">{p.username}</span>
                      {p._id === group?.groupAdmin?._id && (
                        <span className="text-xs text-gray-500 ml-1">
                          (admin)
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && p._id !== user._id && (
                    <button
                      onClick={() => removeMember(p._id)}
                      className="text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add members */}
            {isAdmin && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">
                  Add Members
                </h4>
                {/* You can integrate the same user search component or a simple search/select. 
                    For brevity, we'll add a button that opens the existing NewConversationModal in 'group' mode? 
                    Or a simple text input + button to add by user ID. To keep it simple, I'll leave it as a placeholder. */}
                <button
                  onClick={() =>
                    alert(
                      "Add members UI not shown, but you can call addMembers with selected IDs",
                    )
                  }
                  className="text-blue-500 text-sm"
                >
                  + Add members
                </button>
              </div>
            )}

            {/* Leave Group */}
            <div className="mt-6">
              <button
                onClick={leaveGroup}
                className="text-red-500 text-sm font-semibold"
              >
                Leave Group
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 bg-black opacity-30" onClick={onClose} />
    </div>
  );
};

export default GroupInfoPanel;
