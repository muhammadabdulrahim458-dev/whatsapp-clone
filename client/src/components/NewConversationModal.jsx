import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API = 'http://localhost:5000';

const NewConversationModal = ({ onClose, onConversationCreated }) => {
    const { token } = useAuth();
    const [tab, setTab] = useState('chat'); // 'chat' | 'group'
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);

    // Search users
    useEffect(() => {
        if (search.trim().length < 1) {
            setSearchResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/api/auth/search?q=${search}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.success) setSearchResults(data.data);
            } catch (err) {
                console.error(err);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [search, token]);

    const toggleUser = (user) => {
        if (tab === 'chat') {
            // For one-on-one, only one user can be selected
            setSelectedUsers(prev =>
                prev.some(u => u._id === user._id) ? [] : [user]
            );
        } else {
            // For group, toggle multiple
            setSelectedUsers(prev =>
                prev.some(u => u._id === user._id)
                    ? prev.filter(u => u._id !== user._id)
                    : [...prev, user]
            );
        }
    };

    const createConversation = async () => {
        if (tab === 'chat' && selectedUsers.length !== 1) return;
        if (tab === 'group' && (selectedUsers.length < 1 || !groupName.trim())) return;

        setLoading(true);
        try {
            let res;
            if (tab === 'chat') {
                res = await fetch(`${API}/api/chat/conversations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ participantId: selectedUsers[0]._id }),
                });
            } else {
                res = await fetch(`${API}/api/chat/conversations/group`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        name: groupName,
                        participants: selectedUsers.map(u => u._id),
                    }),
                });
            }
            const data = await res.json();
            if (data.success) {
                onConversationCreated(data.data);
                onClose();
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-96 shadow-xl">
                {/* Header with tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 p-3 font-medium ${tab === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                        onClick={() => setTab('chat')}
                    >
                        New Chat
                    </button>
                    <button
                        className={`flex-1 p-3 font-medium ${tab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                        onClick={() => setTab('group')}
                    >
                        New Group
                    </button>
                </div>

                <div className="p-4">
                    {tab === 'group' && (
                        <input
                            className="w-full border p-2 mb-3 rounded"
                            placeholder="Group name"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                        />
                    )}

                    <input
                        className="w-full border p-2 mb-3 rounded"
                        placeholder="Search users..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />

                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {selectedUsers.map(user => (
                                <span key={user._id} className="bg-blue-100 px-2 py-1 rounded-full text-sm flex items-center">
                                    {user.username}
                                    <button onClick={() => toggleUser(user)} className="ml-1 text-red-500">×</button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Search results */}
                    <div className="max-h-40 overflow-y-auto">
                        {searchResults.map(user => (
                            <div
                                key={user._id}
                                onClick={() => toggleUser(user)}
                                className={`p-2 border-b cursor-pointer hover:bg-gray-50 flex items-center ${selectedUsers.some(u => u._id === user._id) ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.some(u => u._id === user._id)}
                                    readOnly
                                    className="mr-2"
                                />
                                <div>
                                    <div className="font-medium">{user.username}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                            </div>
                        ))}
                        {search && searchResults.length === 0 && (
                            <p className="text-gray-500 text-center">No users found</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end p-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 mr-2 rounded bg-gray-200 hover:bg-gray-300">
                        Cancel
                    </button>
                    <button
                        onClick={createConversation}
                        disabled={loading || (tab === 'chat' ? selectedUsers.length !== 1 : selectedUsers.length < 1 || !groupName.trim())}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewConversationModal;