import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import GroupInfoPanel from "./GroupInfoPanel";
import EmojiPicker from "emoji-picker-react";
import {
  Smile,
  Paperclip,
  SendHorizontal,
  MoreVertical,
  Trash2,
  CornerUpRight,
  Info,
  Download,
  FileText,
  X,
  MessageCircle,
  CheckCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = "http://localhost:5000";

/* ═══════════════════════════════════════════════
   SENTIMENT CONFIG
   Maps a sentiment label → { emoji, tooltip, bubble styles }
   All colours are explicit HSL/hex so they're bold & readable
   in both light and dark mode regardless of shadcn theme.
═══════════════════════════════════════════════ */
const SENTIMENT = {
  positive: {
    emoji: "😊",
    label: "Positive",
    bubble:
      "bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-50 dark:border-emerald-700",
    dot: "bg-emerald-500",
    glow: "shadow-emerald-200/50 dark:shadow-emerald-900/40",
  },
  negative: {
    emoji: "😔",
    label: "Negative",
    bubble:
      "bg-rose-100 text-rose-950 border border-rose-300 dark:bg-rose-900/60 dark:text-rose-50 dark:border-rose-700",
    dot: "bg-rose-500",
    glow: "shadow-rose-200/50 dark:shadow-rose-900/40",
  },
  neutral: {
    emoji: "😐",
    label: "Neutral",
    bubble: "bg-card text-foreground border border-border",
    dot: "bg-muted-foreground/40",
    glow: "",
  },
};

/* ═══════════════════════════════════════════════
   IMPROVED CHAT BACKGROUND
   Subtle gradient + delicate diagonal pattern.
   Fixed layer, never scrolls, works in any theme.
═══════════════════════════════════════════════ */
const ChatWallpaper = () => (
  <div
    aria-hidden
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 0,
      pointerEvents: "none",
    }}
  >
    {/* Base gradient that respects theme */}
    <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-muted/30" />

    {/* Diagonal line pattern – minimal & modern */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full opacity-[0.03] text-foreground"
    >
      <defs>
        <pattern
          id="diagonal-lines"
          x="0"
          y="0"
          width="60"
          height="60"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="60"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diagonal-lines)" />
    </svg>

    {/* Soft vignette for depth */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, transparent 40%, hsl(var(--background)/0.15) 100%)",
      }}
    />
  </div>
);

/* ═══════════════════════════════════════════════
   SENTIMENT BADGE
   Small pill that floats above the bubble on hover,
   showing the emoji + mood word.
═══════════════════════════════════════════════ */
const SentimentBadge = ({ mood }) => {
  const cfg = SENTIMENT[mood] ?? SENTIMENT.neutral;
  if (!mood || mood === "neutral") return null;
  return (
    <span
      className={`
        absolute -top-6 left-1/2 -translate-x-1/2
        flex items-center gap-1
        px-2 py-0.5 rounded-full text-[11px] font-semibold
        whitespace-nowrap select-none pointer-events-none
        border shadow-md z-20
        opacity-0 group-hover/bubble:opacity-100
        translate-y-1 group-hover/bubble:translate-y-0
        transition-all duration-200
        ${
          mood === "positive"
            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700"
            : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900 dark:text-rose-200 dark:border-rose-700"
        }
      `}
    >
      <span className="text-sm leading-none">{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
};

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const getAvatarUrl = (u) => (u?.avatar ? `${API}${u.avatar}` : null);
const uiAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

const formatDateLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
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
  const typingTimeoutRef = useRef(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [showFileModal, setShowFileModal] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [conversationsList, setConversationsList] = useState([]);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });
  const [partner, setPartner] = useState(null);
  const [partnerOnline, setPartnerOnline] = useState(false);

  /* ── Partner / online ── */
  useEffect(() => {
    if (!conversation) return;
    const p = conversation.isGroup
      ? null
      : conversation.participants.find((u) => u._id !== user._id);
    setPartner(p);
    setPartnerOnline(p ? onlineUsers.has(p._id) : false);
  }, [conversation, user?._id, onlineUsers]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  /* ── Typing cleanup ── */
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (socket && conversation?._id)
          socket.emit("stopTyping", conversation._id);
      }
    };
  }, [conversation, socket]);

  /* ── Handlers ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket?.emit("stopTyping", conversation._id);
      typingTimeoutRef.current = null;
    }
    sendMessage(input.trim());
    setInput("");
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!conversation) return;
    if (!typingTimeoutRef.current) socket?.emit("typing", conversation._id);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("stopTyping", conversation._id);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const onEmojiClick = (obj) => {
    setInput((p) => p + obj.emoji);
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
      const res = await fetch(`${API}/api/chat/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const { fileUrl, fileType, fileName } = data.data;
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
          if (!response.success) alert("Failed to send file");
          setUploading(false);
          setShowFileModal(false);
          setSelectedFile(null);
          setFileCaption("");
        },
      );
    } catch {
      alert("Upload failed");
      setUploading(false);
      setShowFileModal(false);
    }
  };

  const handleDeleteMessage = (msg) => {
    setConfirmModal({
      show: true,
      message: "Delete this message? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/api/chat/messages/${msg._id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!data.success) alert(data.message);
        } catch (err) {
          console.error(err);
        } finally {
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
      if (data.success)
        setConversationsList(
          data.data.filter((c) => c._id !== conversation?._id),
        );
    } catch (err) {
      console.error(err);
    }
  };

  const handleForward = async (targetConvId) => {
    if (!forwardMessage) return;
    try {
      const res = await fetch(
        `${API}/api/chat/messages/${forwardMessage._id}/forward`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetConversationId: targetConvId }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setShowForwardModal(false);
        setForwardMessage(null);
      } else {
        alert(data.message);
      }
    } catch {
      alert("Forward failed");
    }
  };

  const handleClearChat = () => {
    setConfirmModal({
      show: true,
      message: "Clear all messages? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `${API}/api/chat/conversations/${conversation._id}/messages`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const data = await res.json();
          if (!data.success) alert(data.message);
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmModal({ show: false, message: "", onConfirm: null });
        }
      },
    });
  };

  /* ── No conversation selected ── */
  if (!conversation) {
    return (
      <div className="flex-1 h-full flex items-center justify-center relative overflow-hidden">
        <ChatWallpaper />
        <div className="relative z-10 text-center space-y-4 px-6">
          <div className="w-20 h-20 rounded-full bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center mx-auto shadow-lg">
            <MessageCircle
              className="w-9 h-9 text-muted-foreground"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-lg">
              Your Messages
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Select a conversation from the sidebar to start chatting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isGroup = conversation.isGroup;
  const headerName = isGroup
    ? conversation.groupName
    : partner?.username || "Unknown";

  /* ── Header avatar ── */
  const HeaderAvatar = () => {
    const src = partner
      ? getAvatarUrl(partner) || uiAvatar(partner.username)
      : uiAvatar(conversation.groupName || "Group");
    const fallback = (
      isGroup ? conversation.groupName : partner?.username || "U"
    )
      .slice(0, 2)
      .toUpperCase();
    return (
      <Avatar className="w-10 h-10 ring-2 ring-background shadow">
        <AvatarImage src={src} className="object-cover" />
        <AvatarFallback className="text-xs font-bold">
          {fallback}
        </AvatarFallback>
      </Avatar>
    );
  };

  /* ── File message renderer ── */
  const renderFileMessage = (msg) => {
    const { fileType, fileUrl, fileName, text } = msg;
    const fullUrl = `${API}${fileUrl}`;
    const isImage = fileType === "image";
    const isVideo = fileType === "video";

    const doDownload = (e) => {
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = fullUrl;
      a.download = fileName || "file";
      a.click();
    };

    if (isImage || isVideo) {
      return (
        <div className="space-y-1.5">
          <div className="overflow-hidden rounded-xl border border-white/10">
            {isImage ? (
              <img
                src={fullUrl}
                alt={fileName}
                className="max-w-full max-h-56 w-full object-cover cursor-pointer hover:brightness-90 transition duration-200"
                onClick={() =>
                  setPreviewFile({
                    url: fullUrl,
                    type: "image",
                    name: fileName,
                  })
                }
              />
            ) : (
              <video controls className="max-w-full max-h-56 w-full rounded-xl">
                <source src={fullUrl} />
              </video>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] opacity-70 px-0.5">
            <span className="truncate max-w-[160px] font-medium">
              {fileName}
            </span>
            <button
              onClick={doDownload}
              className="flex items-center gap-1 hover:opacity-100 font-semibold"
            >
              <Download className="w-3 h-3" /> Save
            </button>
          </div>
          {text && (
            <p className="text-sm pt-1.5 border-t border-white/10 leading-relaxed">
              {text}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 bg-black/10 dark:bg-white/10 rounded-xl p-3">
          <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{fileName}</p>
            <button
              onClick={doDownload}
              className="text-xs opacity-70 hover:opacity-100 mt-0.5 flex items-center gap-1 font-medium"
            >
              <Download className="w-3 h-3" /> Download
            </button>
          </div>
        </div>
        {text && <p className="text-sm leading-relaxed">{text}</p>}
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden relative">
      {/* Fixed wallpaper – elegant new design */}
      <ChatWallpaper />

      {/* ── Header ── */}
      <div className="relative z-10 bg-card/80 backdrop-blur-lg border-b border-border/60 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <HeaderAvatar />
            {partner && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card transition-colors duration-300 ${
                  partnerOnline ? "bg-green-500" : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground text-sm leading-tight truncate">
              {headerName}
            </h2>
            <p className="text-[11px] leading-tight mt-0.5">
              {isGroup ? (
                <span className="text-muted-foreground">
                  {conversation.participants?.length || 0} members
                </span>
              ) : partnerOnline ? (
                <span className="text-green-500 font-medium">● Online</span>
              ) : (
                <span className="text-muted-foreground">
                  Last seen recently
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isGroup && partner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9 text-muted-foreground hover:bg-muted/80"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-3 p-3 border-b border-border/60">
                  <Avatar className="w-9 h-9">
                    <AvatarImage
                      src={getAvatarUrl(partner) || uiAvatar(partner.username)}
                    />
                    <AvatarFallback className="text-xs">
                      {partner.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {partner.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {partner.email}
                    </p>
                  </div>
                </div>
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={handleClearChat}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs cursor-pointer rounded-md"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear Chat History
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isGroup && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGroupInfo(true)}
              className="rounded-full h-9 w-9 text-muted-foreground hover:bg-muted/80"
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Messages scroll area ── */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-0.5">
          {messages.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl px-6 py-4 text-center shadow">
                <p className="text-sm text-muted-foreground">
                  🔒 Say hello — messages stay here.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMine = msg.sender._id === user._id;
            const rawMood = msg.sentiment?.label?.toLowerCase() || "neutral";
            const mood =
              rawMood === "positive"
                ? "positive"
                : rawMood === "negative"
                  ? "negative"
                  : "neutral";
            const sentiment = SENTIMENT[mood];
            const sender = isMine ? user : msg.sender;

            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg =
              idx < messages.length - 1 ? messages[idx + 1] : null;

            const showDateLabel =
              !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
            const isFirstInGroup =
              !prevMsg ||
              prevMsg.sender._id !== msg.sender._id ||
              !isSameDay(prevMsg.createdAt, msg.createdAt);
            const isLastInGroup =
              !nextMsg ||
              nextMsg.sender._id !== msg.sender._id ||
              !isSameDay(msg.createdAt, nextMsg.createdAt);

            const bubbleStyle = isMine
              ? "bg-primary text-primary-foreground shadow-sm"
              : sentiment.bubble +
                " shadow-sm " +
                (mood !== "neutral" ? sentiment.glow + " shadow-md" : "");

            const rounding = isMine
              ? [
                  isFirstInGroup && !isLastInGroup
                    ? "rounded-2xl rounded-tr-md"
                    : "",
                  !isFirstInGroup && !isLastInGroup
                    ? "rounded-2xl rounded-r-md"
                    : "",
                  isLastInGroup && !isFirstInGroup
                    ? "rounded-2xl rounded-br-md"
                    : "",
                  isFirstInGroup && isLastInGroup ? "rounded-2xl" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              : [
                  isFirstInGroup && !isLastInGroup
                    ? "rounded-2xl rounded-tl-md"
                    : "",
                  !isFirstInGroup && !isLastInGroup
                    ? "rounded-2xl rounded-l-md"
                    : "",
                  isLastInGroup && !isFirstInGroup
                    ? "rounded-2xl rounded-bl-md"
                    : "",
                  isFirstInGroup && isLastInGroup ? "rounded-2xl" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

            const ActionMenu = (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full opacity-0 group-hover/msg:opacity-100 transition-all duration-150 bg-card/80 hover:bg-muted border border-border/40 shadow-sm flex-shrink-0 self-end mb-1 backdrop-blur-sm"
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isMine ? "end" : "start"}
                  className="min-w-[130px]"
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setForwardMessage(msg);
                      fetchConversationsForForward();
                      setShowForwardModal(true);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <CornerUpRight className="mr-2 h-3.5 w-3.5" /> Forward
                  </DropdownMenuItem>
                  {isMine && (
                    <DropdownMenuItem
                      onClick={() => handleDeleteMessage(msg)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );

            return (
              <div key={msg._id}>
                {showDateLabel && (
                  <div className="flex items-center justify-center my-5">
                    <span className="bg-card/85 backdrop-blur-sm border border-border/60 text-muted-foreground text-[11px] font-semibold tracking-wide px-3.5 py-1 rounded-full shadow-sm uppercase">
                      {formatDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex items-end gap-2 mb-0.5 group/msg ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMine && (
                    <div className="w-7 flex-shrink-0 self-end mb-0.5">
                      {isLastInGroup ? (
                        <Avatar className="w-7 h-7 ring-1 ring-border/40">
                          <AvatarImage
                            src={
                              getAvatarUrl(sender) || uiAvatar(sender.username)
                            }
                          />
                          <AvatarFallback className="text-[10px] font-semibold">
                            {sender.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-7" />
                      )}
                    </div>
                  )}

                  {!isMine && ActionMenu}

                  <div
                    className={`
                      relative max-w-[70%] px-3.5 py-2.5 group/bubble
                      ${bubbleStyle} ${rounding}
                    `}
                    style={{ wordBreak: "break-word" }}
                  >
                    {!isMine && mood !== "neutral" && (
                      <SentimentBadge mood={mood} />
                    )}

                    {!isMine && isGroup && isFirstInGroup && (
                      <p className="text-[11px] font-bold text-primary mb-1 leading-none">
                        {sender.username}
                      </p>
                    )}

                    {msg.isForwarded && (
                      <div className="flex items-center gap-1 text-[10px] opacity-60 mb-1.5 italic">
                        <CornerUpRight className="w-2.5 h-2.5" />
                        Forwarded
                      </div>
                    )}

                    {msg.fileUrl ? (
                      renderFileMessage(msg)
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    )}

                    <div
                      className={`flex items-center justify-end gap-1 mt-1.5 ${
                        isMine ? "opacity-70" : "opacity-50"
                      }`}
                    >
                      {!isMine && mood !== "neutral" && (
                        <span className="text-[11px] leading-none">
                          {sentiment.emoji}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isMine && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>

                  {isMine && ActionMenu}
                </div>
              </div>
            );
          })}

          {typingUser && (
            <div className="flex items-end gap-2 justify-start mt-3">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarImage src={uiAvatar(typingUser.username)} />
                <AvatarFallback className="text-[10px]">
                  {typingUser.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow flex items-center gap-1.5">
                {["-0.3s", "-0.15s", "0s"].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                    style={{ animationDelay: d }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="relative z-10 p-4 border-t border-border/60 bg-card/80 backdrop-blur-lg">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex gap-1 items-center">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9 text-muted-foreground hover:bg-muted/80"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                className="w-auto p-0 border-border bg-popover"
              >
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full h-9 w-9 text-muted-foreground hover:bg-muted/80"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="flex-1 bg-muted/50 rounded-2xl border border-border/60 focus-within:ring-1 focus-within:ring-primary transition-all">
            <Textarea
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="min-h-[2.5rem] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-2 text-sm"
              rows={1}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            className="rounded-full h-9 w-9 bg-primary hover:bg-primary/90 transition-all"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Group Info Panel Modal */}
      {showGroupInfo && (
        <GroupInfoPanel
          conversation={conversation}
          onClose={() => setShowGroupInfo(false)}
          socket={socket}
        />
      )}

      {/* File upload modal */}
      <Dialog open={showFileModal} onOpenChange={setShowFileModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send File</DialogTitle>
            <DialogDescription>
              Add a caption (optional) and send the file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium truncate">
                {selectedFile?.name}
              </span>
            </div>
            <Textarea
              placeholder="Caption (optional)"
              value={fileCaption}
              onChange={(e) => setFileCaption(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileModal(false)}>
              Cancel
            </Button>
            <Button onClick={uploadFileWithCaption} disabled={uploading}>
              {uploading ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward modal */}
      <Dialog open={showForwardModal} onOpenChange={setShowForwardModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>
              Select a conversation to forward this message to.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <div className="space-y-2">
              {conversationsList.map((conv) => {
                const isGroupConv = conv.isGroup;
                const convName = isGroupConv
                  ? conv.groupName
                  : conv.participants.find((p) => p._id !== user._id)
                      ?.username || "Unknown";
                return (
                  <div
                    key={conv._id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition"
                    onClick={() => handleForward(conv._id)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={
                          isGroupConv
                            ? uiAvatar(conv.groupName)
                            : getAvatarUrl(
                                conv.participants.find(
                                  (p) => p._id !== user._id,
                                ),
                              ) || uiAvatar(convName)
                        }
                      />
                      <AvatarFallback>
                        {convName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{convName}</p>
                      <p className="text-xs text-muted-foreground">
                        {isGroupConv ? "Group" : "Direct Message"}
                      </p>
                    </div>
                  </div>
                );
              })}
              {conversationsList.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No other conversations found.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Preview modal for images */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-none">
          {previewFile?.type === "image" ? (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          ) : (
            <video controls autoPlay className="w-full max-h-[80vh] rounded-lg">
              <source src={previewFile?.url} />
            </video>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation modal */}
      <AlertDialog
        open={confirmModal.show}
        onOpenChange={(open) =>
          !open &&
          setConfirmModal({ show: false, message: "", onConfirm: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmModal.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModal.onConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatArea;
