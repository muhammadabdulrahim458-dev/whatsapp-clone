import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const Home = () => {
  const { token, user } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  
  const socket = useSocket(token);

  // Typing events
  useEffect(() => {
    if (!socket) return;
    socket.on("userTyping", ({ userId, username, conversationId }) => {
      setTypingUsers((prev) => ({ ...prev, [conversationId]: { userId, username } }));
    });
    socket.on("userStopTyping", ({ conversationId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    });
    return () => {
      socket.off("userTyping");
      socket.off("userStopTyping");
    };
  }, [socket]);

  useEffect(() => {
    console.log('🔌 Socket object:', socket ? 'present' : 'null');
    if (socket) {
      console.log('🔌 Connected:', socket.connected);
      console.log('🔌 Socket ID:', socket.id);
    }
  }, [socket]);
  
  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const sorted = data.data.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setConversations(sorted);
        // Load unread counts from server
        const counts = {};
        sorted.forEach(conv => {
          if (conv.unreadCount && conv.unreadCount > 0) {
            counts[conv._id] = conv.unreadCount;
          }
        });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error('❌ fetchConversations error:', err);
    }
  };

  // When active conversation changes
  useEffect(() => {
    if (!activeConversation) return;
    fetchMessages(activeConversation._id);
    if (socket) {
      socket.emit('joinConversation', activeConversation._id);
    }
    // Reset unread count on backend
    fetch(`http://localhost:5000/api/chat/conversations/${activeConversation._id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(console.error);
    // Reset local unread count
    setUnreadCounts(prev => ({ ...prev, [activeConversation._id]: 0 }));
  }, [activeConversation, socket]);

  // Online status
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      socket.emit('getOnlineUsers');
    };
    socket.on('connect', handleConnect);
    socket.on("onlineUsers", (list) => {
      setOnlineUsers(new Set(list));
    });
    socket.on("userStatus", ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    return () => {
      socket.off('connect', handleConnect);
      socket.off("onlineUsers");
      socket.off("userStatus");
    };
  }, [socket]);
  
  const fetchMessages = async (conversationId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error('❌ fetchMessages error:', err);
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      console.log('📩 newMessage received:', message._id, 'conversation:', message.conversation);
      
      // Desktop notification (Electron only)
      if (message.sender._id !== user._id && window.electronAPI && window.electronAPI.showNotification) {
        const senderName = message.sender.username;
        const conversationName = message.conversationName || '';
        const title = conversationName ? `${senderName} (${conversationName})` : senderName;
        const preview = message.text ? message.text.substring(0, 50) : '📎 File';
        window.electronAPI.showNotification(title, preview);
      }
      
      // Update messages if active conversation
      if (activeConversation && message.conversation === activeConversation._id) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setUnreadCounts(prev => ({ ...prev, [message.conversation]: 0 }));
      } else {
        setUnreadCounts(prev => ({
          ...prev,
          [message.conversation]: (prev[message.conversation] || 0) + 1,
        }));
      }
      
      // Update conversation list
      setConversations(prev => {
        const updated = prev.map(conv =>
          conv._id === message.conversation
            ? { ...conv, lastMessage: message, updatedAt: message.createdAt }
            : conv
        );
        updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return [...updated];
      });
    };

    const handleNewConversation = (newConv) => {
      setConversations(prev => [newConv, ...prev]);
    };

    const handleMessageDeletedForMe = ({ messageId, conversationId }) => {
      if (activeConversation?._id === conversationId) {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
    };

    const handleChatCleared = ({ conversationId }) => {
      if (activeConversation?._id === conversationId) {
        setMessages([]);
      }
      setConversations(prev =>
        prev.map(conv =>
          conv._id === conversationId ? { ...conv, lastMessage: null } : conv
        )
      );
    };

    const handleGroupUpdated = (updatedGroup) => {
      setConversations(prev =>
        prev.map(conv => conv._id === updatedGroup._id ? updatedGroup : conv)
      );
      if (activeConversation?._id === updatedGroup._id) {
        setActiveConversation(updatedGroup);
      }
    };

    const handleGroupDeleted = (groupId) => {
      setConversations(prev => prev.filter(conv => conv._id !== groupId));
      if (activeConversation?._id === groupId) {
        setActiveConversation(null);
        setMessages([]);
      }
    };

    const handleConversationRemoved = ({ conversationId }) => {
      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      if (activeConversation?._id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    };

    const handleParticipantLeft = ({ conversationId, userId }) => {
      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      if (activeConversation?._id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('newConversation', handleNewConversation);
    socket.on('messageDeletedForMe', handleMessageDeletedForMe);
    socket.on('chatCleared', handleChatCleared);
    socket.on('groupUpdated', handleGroupUpdated);
    socket.on('groupDeleted', handleGroupDeleted);
    socket.on('conversationRemoved', handleConversationRemoved);
    socket.on('participantLeft', handleParticipantLeft);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('newConversation', handleNewConversation);
      socket.off('messageDeletedForMe', handleMessageDeletedForMe);
      socket.off('chatCleared', handleChatCleared);
      socket.off('groupUpdated', handleGroupUpdated);
      socket.off('groupDeleted', handleGroupDeleted);
      socket.off('conversationRemoved', handleConversationRemoved);
      socket.off('participantLeft', handleParticipantLeft);
    };
  }, [socket, activeConversation, user]);

  const sendMessage = (text) => {
    if (!socket || !activeConversation) return;
    socket.emit('sendMessage', {
      conversationId: activeConversation._id,
      text,
    }, (response) => {
      if (response?.error) console.error('❌ Send failed:', response.error);
    });
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        refreshConversations={fetchConversations}
        unreadCounts={unreadCounts}
      />
      <ChatArea
        conversation={activeConversation}
        messages={messages}
        sendMessage={sendMessage}
        onlineUsers={onlineUsers}
        typingUser={typingUsers[activeConversation?._id] || null}
        socket={socket}
      />
    </div>
  );
};

export default Home;