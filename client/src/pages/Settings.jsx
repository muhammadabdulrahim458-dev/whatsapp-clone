import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

const Settings = () => {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setAvatar(user.avatar);
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    const formData = new FormData();
    formData.append("avatar", avatarFile);
    try {
      const res = await fetch(`${API}/api/auth/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatar(data.data.avatar);
        setAvatarFile(null);
        setPreview(null);
        setMessage("Avatar updated!");
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage("Upload failed");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          email,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Profile updated!");
        // Update local user context if name/email changed
        login(
          {
            ...user,
            username: data.data.username,
            email: data.data.email,
            avatar: avatar,
          },
          token,
        );
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage("Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>

        {message && <p className="text-sm text-blue-600 mb-4">{message}</p>}

        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={
              preview ||
              (avatar ? `${API}${avatar}` : "https://via.placeholder.com/100")
            }
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-300 mb-2"
          />
          <label className="cursor-pointer text-blue-500 text-sm mb-2">
            Change Avatar
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </label>
          {avatarFile && (
            <button
              onClick={handleUploadAvatar}
              className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
            >
              Upload
            </button>
          )}
        </div>

        {/* Profile Form */}
        <form onSubmit={handleUpdateProfile}>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border p-2 rounded mb-3"
          />

          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded mb-3"
          />

          <label className="block text-sm font-medium mb-1">
            Current Password (to change password)
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border p-2 rounded mb-3"
          />

          <label className="block text-sm font-medium mb-1">
            New Password (optional)
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          className="w-full mt-4 bg-gray-300 text-gray-700 p-2 rounded hover:bg-gray-400"
        >
          Back to Chat
        </button>
      </div>
    </div>
  );
};

export default Settings;
