import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:5000';

const NewConversationModal = ({ onClose, onConversationCreated }) => {
    const { token } = useAuth();
    const [tab, setTab] = useState('chat');
    const [contactInput, setContactInput] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);
    const [groupSearch, setGroupSearch] = useState('');
    const [groupSearchResults, setGroupSearchResults] = useState([]);

    const handleFindContact = async () => {
        if (!contactInput.trim()) {
            setError('Please enter a username or email');
            return;
        }
        setLoading(true);
        setError('');
        setFoundUser(null);
        try {
            const res = await fetch(`${API}/api/auth/search?q=${encodeURIComponent(contactInput.trim())}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setFoundUser(data.data[0]);
            } else {
                setError('No user found with that exact username or email');
            }
        } catch (err) {
            console.error(err);
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const startConversation = async () => {
        if (!foundUser) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/chat/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ participantId: foundUser._id }),
            });
            const data = await res.json();
            if (data.success) {
                onConversationCreated(data.data);
                onClose();
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to create conversation');
        } finally {
            setLoading(false);
        }
    };

    const searchGroupUsers = async (query) => {
        if (!query.trim()) {
            setGroupSearchResults([]);
            return;
        }
        try {
            const res = await fetch(`${API}/api/auth/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setGroupSearchResults(data.data);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleGroupMember = (user) => {
        setGroupMembers(prev =>
            prev.some(m => m._id === user._id)
                ? prev.filter(m => m._id !== user._id)
                : [...prev, user]
        );
    };

    const createGroup = async () => {
        if (!groupName.trim() || groupMembers.length < 1) {
            setError('Group name and at least one member required');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/chat/conversations/group`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: groupName,
                    participants: groupMembers.map(m => m._id),
                }),
            });
            const data = await res.json();
            if (data.success) {
                onConversationCreated(data.data);
                onClose();
            } else {
                setError(data.message);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        // No background overlay – just a floating popup
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-white rounded-lg w-96 shadow-xl pointer-events-auto relative">
                {/* Close button (X) */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
                    title="Close"
                >
                    &times;
                </button>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 p-3 font-medium ${tab === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                        onClick={() => { setTab('chat'); setError(''); setFoundUser(null); setContactInput(''); }}
                    >
                        Add Contact
                    </button>
                    <button
                        className={`flex-1 p-3 font-medium ${tab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                        onClick={() => { setTab('group'); setError(''); setGroupMembers([]); setGroupName(''); }}
                    >
                        Create Group
                    </button>
                </div>

                <div className="p-4">
                    {tab === 'chat' ? (
                        <>
                            <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username or Email
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 border p-2 rounded"
                                        placeholder="e.g., john_doe or john@example.com"
                                        value={contactInput}
                                        onChange={(e) => setContactInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleFindContact()}
                                    />
                                    <button
                                        onClick={handleFindContact}
                                        disabled={loading}
                                        className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {loading ? '...' : 'Find'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm mb-3">{error}</div>
                            )}

                            {foundUser && (
                                <div className="border rounded-lg p-3 bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={foundUser.avatar ? `${API}${foundUser.avatar}` : `https://ui-avatars.com/api/?name=${foundUser.username}&background=random`}
                                            alt={foundUser.username}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                        <div>
                                            <div className="font-semibold">{foundUser.username}</div>
                                            <div className="text-sm text-gray-500">{foundUser.email}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={startConversation}
                                        disabled={loading}
                                        className="mt-3 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
                                    >
                                        {loading ? 'Adding...' : 'Add to contacts & start chat'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <input
                                className="w-full border p-2 mb-3 rounded"
                                placeholder="Group name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            />

                            <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Add members (exact username/email)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 border p-2 rounded"
                                        placeholder="Type username or email"
                                        value={groupSearch}
                                        onChange={(e) => {
                                            setGroupSearch(e.target.value);
                                            searchGroupUsers(e.target.value);
                                        }}
                                    />
                                </div>
                            </div>

                            {groupSearchResults.length > 0 && (
                                <div className="max-h-40 overflow-y-auto border rounded mb-3">
                                    {groupSearchResults.map(user => (
                                        <div
                                            key={user._id}
                                            onClick={() => toggleGroupMember(user)}
                                            className={`p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${groupMembers.some(m => m._id === user._id) ? 'bg-blue-50' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={groupMembers.some(m => m._id === user._id)}
                                                readOnly
                                                className="mr-2"
                                            />
                                            <div>
                                                <div className="font-medium">{user.username}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {groupMembers.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {groupMembers.map(user => (
                                        <span key={user._id} className="bg-blue-100 px-2 py-1 rounded-full text-sm flex items-center">
                                            {user.username}
                                            <button onClick={() => toggleGroupMember(user)} className="ml-1 text-red-500">×</button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
                        </>
                    )}
                </div>

                <div className="flex justify-end p-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 mr-2 rounded bg-gray-200 hover:bg-gray-300">
                        Cancel
                    </button>
                    {tab === 'group' && (
                        <button
                            onClick={createGroup}
                            disabled={loading || !groupName.trim() || groupMembers.length === 0}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Group'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewConversationModal;