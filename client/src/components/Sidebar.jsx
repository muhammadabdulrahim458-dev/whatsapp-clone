import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import NewConversationModal from "./NewConversationModal";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Settings, LogOut, MoreVertical, Trash2 } from "lucide-react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });
  const navigate = useNavigate();

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getAvatar = (u) =>
    u?.avatar
      ? `${API}${u.avatar}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.username || "User")}&background=random`;

  const deleteContact = (conversationId) => {
    setConfirmModal({
      show: true,
      message:
        "Delete this contact? This will remove the conversation from your chat list.",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `${API}/api/chat/conversations/${conversationId}/contact`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
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
        }
      },
    });
  };

  const renderConversation = (conv, index) => {
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
    if (
      lastMsg &&
      (!clearedAt || new Date(lastMsg.createdAt) > new Date(clearedAt))
    ) {
      lastMsgText =
        lastMsg.text?.length > 25
          ? lastMsg.text.slice(0, 25) + "..."
          : lastMsg.text || "File";
    }

    const isActive = activeConversation?._id === conv._id;
    const unreadCount = unreadCounts[conv._id] || 0;

    return (
      <motion.div
        key={conv._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
        className={`group relative flex items-center gap-3 p-3 cursor-pointer select-none transition-all border-b border-border/40 hover:bg-muted/50 ${
          isActive ? "bg-accent text-accent-foreground" : ""
        }`}
        onClick={() => setActiveConversation(conv)}
      >
        {/* Active Border Overlay Indicator */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        <div className="relative flex-shrink-0">
          <Avatar className="w-11 h-11 border border-border/40">
            <AvatarImage src={avatarSrc} alt={name} className="object-cover" />
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background transition-colors duration-300 ${
              unreadCount > 0
                ? "bg-primary animate-pulse"
                : "bg-muted-foreground/40"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-0.5">
            <h3
              className={`text-sm font-medium truncate ${unreadCount > 0 ? "font-semibold text-foreground" : "text-foreground/90"}`}
            >
              {name}
            </h3>
            <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
              {formatTime(lastMsg?.createdAt)}
            </span>
          </div>
          <p
            className={`text-xs truncate ${unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {lastMsgText}
          </p>
        </div>

        {!isGroup && (
          <div
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => deleteContact(conv._id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <div className="w-full h-full flex flex-col bg-card">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 border border-border">
              <AvatarImage
                src={getAvatar(user)}
                alt={user?.username}
                className="object-cover"
              />
              <AvatarFallback>
                {user?.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm tracking-tight text-foreground">
              {user?.username}
            </span>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowModal(true)}
              className="rounded-full h-9 w-9"
            >
              <Plus className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              className="rounded-full h-9 w-9"
            >
              <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {conversations.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground/70 mt-12 tracking-wide">
                No active conversations
              </p>
            ) : (
              conversations.map((conv, index) =>
                renderConversation(conv, index),
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* New Conversation Modal Component Linkage */}
      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onConversationCreated={(newConv) => {
            refreshConversations();
            setActiveConversation(newConv);
          }}
        />
      )}

      {/* Premium Shadcn Alert confirmation wrapper */}
      <AlertDialog
        open={confirmModal.show}
        onOpenChange={(open) =>
          !open &&
          setConfirmModal({ show: false, message: "", onConfirm: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmModal.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmModal.onConfirm?.()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Sidebar;
