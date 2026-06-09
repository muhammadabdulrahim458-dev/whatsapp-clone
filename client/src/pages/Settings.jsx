// src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Laptop, Upload, Save, ArrowLeft } from "lucide-react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const API = "http://localhost:5000";

const Settings = () => {
  const { user, token, login } = useAuth();
  const { theme, setTheme } = useTheme();
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
    setLoading(true);
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
        // Update user context
        login({ ...user, avatar: data.data.avatar }, token);
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage("Upload failed");
    } finally {
      setLoading(false);
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
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Profile updated!");
        login(
          {
            ...user,
            username: data.data.username,
            email: data.data.email,
            avatar: avatar,
          },
          token,
        );
        setCurrentPassword("");
        setNewPassword("");
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Settings</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  {theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Laptop className="mr-2 h-4 w-4" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardDescription>
            Manage your account settings and preferences.
          </CardDescription>
          {message && (
            <div className="text-sm text-primary bg-primary/10 p-2 rounded-md mt-2">
              {message}
            </div>
          )}
        </CardHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 px-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <form onSubmit={handleUpdateProfile}>
              <CardContent className="space-y-6 pt-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="w-24 h-24 ring-2 ring-border">
                    <AvatarImage
                      src={preview || (avatar ? `${API}${avatar}` : undefined)}
                      alt="Avatar"
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl bg-muted">
                      {username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <label htmlFor="avatar-upload">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById("avatar-upload").click()
                        }
                      >
                        Choose File
                      </Button>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                    {avatarFile && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleUploadAvatar}
                        disabled={loading}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required to change password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">
                      New Password (optional)
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Chat
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                  <Save className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="appearance">
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Theme</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred color scheme
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between"
                      >
                        {theme === "light" && "Light"}
                        {theme === "dark" && "Dark"}
                        {theme === "system" && "System"}
                        {theme === "light" ? (
                          <Sun className="ml-2 h-4 w-4" />
                        ) : theme === "dark" ? (
                          <Moon className="ml-2 h-4 w-4" />
                        ) : (
                          <Laptop className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 h-4 w-4" /> Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 h-4 w-4" /> Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Laptop className="mr-2 h-4 w-4" /> System
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/")}
              >
                Back to Chat
              </Button>
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Settings;
