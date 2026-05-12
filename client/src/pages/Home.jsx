import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const Home = () => {
  const { token } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // { [conversationId]: { userId, username } }
  
  const socket = useSocket(token);



  // Listen for typing events
  useEffect(() => {
    if (!socket) return;

    socket.on("userTyping", ({ userId, username, conversationId }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: { userId, username },
      }));
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

  
  
  // ==============================
  // Socket Debugging
  // ==============================
  useEffect(() => {
    console.log('🔌 Socket object:', socket ? 'present' : 'null');

    if (socket) {
      console.log('🔌 Connected:', socket.connected);
      console.log('🔌 Socket ID:', socket.id);
    }
  }, [socket]);
  
  // ==============================
  // Fetch Conversations On Mount
  // ==============================
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      console.log('📋 Fetching conversations...');

      const res = await fetch(
        'http://localhost:5000/api/chat/conversations',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      console.log('📋 Conversations response:', data);

      if (data.success) {
        setConversations(data.data);
      }
    } catch (err) {
      console.error('❌ fetchConversations error:', err);
    }
  };

  // ==============================
  // Fetch Messages + Join Room
  // ==============================
  useEffect(() => {
    if (!activeConversation) return;

    console.log(
      '🟢 Active conversation:',
      activeConversation._id
    );

    fetchMessages(activeConversation._id);

    if (socket) {
      console.log(
        '🟢 Joining conversation:',
        activeConversation._id
      );

      socket.emit(
        'joinConversation',
        activeConversation._id
      );
    }
  }, [activeConversation, socket]);

  // Listen for online status updates
  useEffect(() => {
    if (!socket) return;

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
      socket.off("onlineUsers");
      socket.off("userStatus");
    };
  }, [socket]);
  
  const fetchMessages = async (conversationId) => {
    try {
      console.log(
        '💬 Fetching messages:',
        conversationId
      );

      const res = await fetch(
        `http://localhost:5000/api/chat/conversations/${conversationId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      console.log('💬 Messages response:', data);

      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error('❌ fetchMessages error:', err);
    }
  };

  // ==============================
  // Socket Listeners
  // ==============================
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ Socket not ready');
      return;
    }

    console.log('👂 Setting up listeners');

    // New Message
    const handleNewMessage = (message) => {
      console.log(
        '📩 newMessage received:',
        message._id
      );

      setMessages((prev) => {
        const exists = prev.some(
          (msg) => msg._id === message._id
        );

        if (exists) {
          console.log(
            '⏩ Duplicate message skipped'
          );
          return prev;
        }

        return [...prev, message];
      });

      fetchConversations();
    };

    // New Conversation
    const handleNewConversation = () => {
      console.log('🆕 newConversation received');
      fetchConversations();
    };

    socket.on('newMessage', handleNewMessage);

    socket.on(
      'newConversation',
      handleNewConversation
    );

    // Debug all events
    socket.onAny((eventName, ...args) => {
      console.log(
        '📨 Event:',
        eventName,
        args
      );
    });

    return () => {
      console.log('🗑️ Cleaning listeners');

      socket.off(
        'newMessage',
        handleNewMessage
      );

      socket.off(
        'newConversation',
        handleNewConversation
      );

      socket.offAny();
    };
  }, [socket]);

  // ==============================
  // Send Message
  // ==============================
  const sendMessage = (text) => {
    console.log('📤 Sending message:', text);

    if (!socket) {
      console.error('❌ Socket not available');
      return;
    }

    if (!activeConversation) {
      console.error('❌ No active conversation');
      return;
    }

    const payload = {
      conversationId: activeConversation._id,
      text,
    };

    socket.emit(
      'sendMessage',
      payload,
      (response) => {
        console.log(
          '📤 Server response:',
          response
        );

        if (response?.error) {
          console.error(
            '❌ Send failed:',
            response.error
          );
        } else {
          console.log('✅ Message sent');
        }
      }
    );
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        refreshConversations={fetchConversations}
      />

      <ChatArea
        conversation={activeConversation}
        messages={messages}
        sendMessage={sendMessage}
        onlineUsers={onlineUsers}
        typingUser={typingUsers[activeConversation?._id] || null} // only active conv
        socket={socket}
      />
    </div>
  );
};

export default Home;