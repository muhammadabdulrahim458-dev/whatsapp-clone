import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { X, Search, Users, Loader2, UserPlus } from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const API = "http://localhost:5000";






const NewConversationModal = ({ onClose, onConversationCreated }) => {
  const { token } = useAuth();
  const [tab, setTab] = useState("chat");
  const [contactInput, setContactInput] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);

  const handleTabChange = (value) => {
    setTab(value );
    setError("");
    setContactInput("");
    setFoundUser(null);
    setGroupName("");
    setGroupMembers([]);
    setGroupSearch("");
    setGroupSearchResults([]);
  };

  const handleFindContact = async () => {
    if (!contactInput.trim()) {
      setError("Please enter a username or email");
      return;
    }
    setLoading(true);
    setError("");
    setFoundUser(null);
    try {
      const res = await fetch(
        `${API}/api/auth/search?q=${encodeURIComponent(contactInput.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        setFoundUser(data.data[0]);
      } else {
        setError("No user found with that exact username or email");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong matching users");
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ participantId: foundUser._id }),
      });
      const data = await res.json();
      if (data.success) {
        onConversationCreated(data.data);
        onClose();
      } else {
        setError(data.message || "Failed to initialize conversation");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create conversation context");
    } finally {
      setLoading(false);
    }
  };

  const searchGroupUsers = useCallback(
    async (query) => {
      if (!query.trim()) {
        setGroupSearchResults([]);
        return;
      }
      try {
        const res = await fetch(
          `${API}/api/auth/search?q=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setGroupSearchResults(data.data);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [token]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => searchGroupUsers(groupSearch), 250);
    return () => clearTimeout(timeoutId);
  }, [groupSearch, searchGroupUsers]);

  const toggleGroupMember = (targetUser) => {
    setGroupMembers((prev) =>
      prev.some((m) => m._id === targetUser._id)
        ? prev.filter((m) => m._id !== targetUser._id)
        : [...prev, targetUser]
    );
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length < 1) {
      setError("Group name and at least one member required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/chat/conversations/group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          participants: groupMembers.map((m) => m._id),
        }),
      });
      const data = await res.json();
      if (data.success) {
        onConversationCreated(data.data);
        onClose();
      } else {
        setError(data.message || "Error processing group initialization request");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create room group");
    } finally {
      setLoading(false);
    }
  };

  // Helper for avatar fallback initials
  const getInitials = (username) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-background rounded-lg border shadow-2xl overflow-hidden"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <h2 className="text-lg font-semibold">New Conversation</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full rounded-none border-b bg-muted/30 h-auto p-0">
              <TabsTrigger
                value="chat"
                className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Direct Chat
              </TabsTrigger>
              <TabsTrigger
                value="group"
                className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Users className="h-4 w-4 mr-2" />
                Create Group
              </TabsTrigger>
            </TabsList>

            <div className="p-5">
              {/* Direct Chat Tab */}
              <TabsContent value="chat" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-search">Search by username or email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="contact-search"
                      placeholder="Enter username or email..."
                      value={contactInput}
                      onChange={(e) => setContactInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleFindContact()}
                      className="flex-1"
                    />
                    <Button onClick={handleFindContact} disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Find
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/15 text-destructive text-sm p-3 border border-destructive/20">
                    {error}
                  </div>
                )}

                {foundUser && (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={
                            foundUser.avatar
                              ? `${API}${foundUser.avatar}`
                              : undefined
                          }
                          alt={foundUser.username}
                        />
                        <AvatarFallback>{getInitials(foundUser.username)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{foundUser.username}</p>
                        <p className="text-xs text-muted-foreground">{foundUser.email}</p>
                      </div>
                    </div>
                    <Button onClick={startConversation} disabled={loading} className="w-full">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Start Chat
                    </Button>
                  </Card>
                )}
              </TabsContent>

              {/* Create Group Tab */}
              <TabsContent value="group" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    placeholder="Enter group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-members">Add Members</Label>
                  <Input
                    id="group-members"
                    placeholder="Search by username or email..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                </div>

                {/* Search Results */}
                {groupSearchResults.length > 0 && (
                  <ScrollArea className="h-48 rounded-md border">
                    <div className="space-y-1 p-1">
                      {groupSearchResults.map((user) => {
                        const isChecked = groupMembers.some((m) => m._id === user._id);
                        return (
                          <div
                            key={user._id}
                            onClick={() => toggleGroupMember(user)}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-primary/10 hover:bg-primary/15"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={
                                    user.avatar
                                      ? `${API}${user.avatar}`
                                      : undefined
                                  }
                                  alt={user.username}
                                />
                                <AvatarFallback className="text-xs">
                                  {getInitials(user.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{user.username}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            <Checkbox checked={isChecked} />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                {/* Selected Members */}
                {groupMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Members ({groupMembers.length})</Label>
                    <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30 min-h-[60px]">
                      {groupMembers.map((user) => (
                        <Badge key={user._id} variant="secondary" className="gap-1 pl-2">
                          {user.username}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroupMember(user);
                            }}
                            className="ml-1 hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {groupMembers.length === 0 && (
                        <p className="text-xs text-muted-foreground p-1">
                          No members selected
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-destructive/15 text-destructive text-sm p-3 border border-destructive/20">
                    {error}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {tab === "group" && (
              <Button
                onClick={createGroup}
                disabled={loading || !groupName.trim() || groupMembers.length === 0}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Group
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewConversationModal;