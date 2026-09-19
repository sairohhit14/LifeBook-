import { 
  User, 
  Memory, 
  Milestone, 
  LegacyMessage, 
  FamilyMember, 
  DocumentFile, 
  Notification, 
  ChatMessage, 
  AIStory, 
  DashboardStats 
} from "./types";

// API base URL - dynamic resolved based on deployment
const API_BASE = import.meta.env.VITE_API_BASE || "";

const getHeaders = () => {
  const userId = localStorage.getItem("lifebook_userId");
  return {
    "Content-Type": "application/json",
    ...(userId ? { "Authorization": `Bearer ${userId}` } : {})
  };
};

export const api = {
  // Auth
  setSession(userId: string) {
    localStorage.setItem("lifebook_userId", userId);
  },
  
  clearSession() {
    localStorage.removeItem("lifebook_userId");
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem("lifebook_userId");
  },

  getUserId(): string | null {
    return localStorage.getItem("lifebook_userId");
  },

  async register(data: any): Promise<User> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async login(data: any): Promise<User> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async loginWithGoogle(email: string, name: string, googleId?: string): Promise<User> {
    // Demo path: explicit demo identity, sent as a scoped credential string.
    // Only meaningful when the server runs with DEMO_INSECURE_GOOGLE=1.
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: `${email}|${name || ""}` })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Google Sign-In failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async loginWithGoogleCredential(credential: string): Promise<User> {
    // Real path: Firebase Auth ID token from the Google popup, verified
    // server-side. The server never trusts client-sent profile fields.
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Google Sign-In failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/api/auth/current-user`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Failed to fetch user session");
    }
    return res.json();
  },

  async familyLogin(legacyKey: string, familyMemberName: string): Promise<User & { ownerName: string }> {
    const res = await fetch(`${API_BASE}/api/auth/family-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legacyKey, familyMemberName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Family member login failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; previewUrl?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Password recovery request failed");
    }
    return res.json();
  },

  async confirmLogin(email: string, otp: string): Promise<User> {
    const res = await fetch(`${API_BASE}/api/auth/confirm-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login confirmation failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  // File Upload helper
  async uploadFile(filename: string, base64Data: string, type: 'image' | 'video' | 'audio'): Promise<{ url: string, name: string }> {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ filename, base64Data, type })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "File upload failed");
    }
    return res.json();
  },

  async describeImage(base64Data: string): Promise<{ description: string }> {
    const res = await fetch(`${API_BASE}/api/describe-image`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ base64Data })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Image description failed");
    }
    return res.json();
  },

  async deliverMessageInstantly(id: string): Promise<LegacyMessage> {
    const res = await fetch(`${API_BASE}/api/messages/${id}/deliver`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Instant delivery failed");
    }
    return res.json();
  },

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/api/dashboard/stats`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  // Memories
  async getMemories(): Promise<Memory[]> {
    const res = await fetch(`${API_BASE}/api/memories`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch memories");
    return res.json();
  },

  async createMemory(data: Partial<Memory>): Promise<Memory> {
    const res = await fetch(`${API_BASE}/api/memories`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to save memory");
    return res.json();
  },

  async updateMemory(id: string, data: Partial<Memory>): Promise<Memory> {
    const res = await fetch(`${API_BASE}/api/memories/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update memory");
    return res.json();
  },

  async deleteMemory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/memories/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete memory");
  },

  // Timeline (Milestones)
  async getTimeline(): Promise<Milestone[]> {
    const res = await fetch(`${API_BASE}/api/timeline`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch timeline");
    return res.json();
  },

  async createMilestone(data: Partial<Milestone>): Promise<Milestone> {
    const res = await fetch(`${API_BASE}/api/timeline`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create milestone");
    return res.json();
  },

  async updateMilestone(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const res = await fetch(`${API_BASE}/api/timeline/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update milestone");
    return res.json();
  },

  async deleteMilestone(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/timeline/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete milestone");
  },

  // Legacy Messages
  async getMessages(): Promise<LegacyMessage[]> {
    const res = await fetch(`${API_BASE}/api/messages`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch legacy messages");
    return res.json();
  },

  async createMessage(data: Partial<LegacyMessage>): Promise<LegacyMessage> {
    const res = await fetch(`${API_BASE}/api/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to schedule legacy message");
    return res.json();
  },

  async updateMessage(id: string, data: Partial<LegacyMessage>): Promise<LegacyMessage> {
    const res = await fetch(`${API_BASE}/api/messages/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update message");
    return res.json();
  },

  async deleteMessage(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/messages/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete message");
  },

  // Family Management
  async getFamily(): Promise<FamilyMember[]> {
    const res = await fetch(`${API_BASE}/api/family`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch family circle");
    return res.json();
  },

  async createFamilyMember(data: Partial<FamilyMember>): Promise<FamilyMember> {
    const res = await fetch(`${API_BASE}/api/family`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to add family member");
    return res.json();
  },

  async updateFamilyMember(id: string, data: Partial<FamilyMember>): Promise<FamilyMember> {
    const res = await fetch(`${API_BASE}/api/family/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update family member");
    return res.json();
  },

  async deleteFamilyMember(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/family/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to remove family member");
  },

  // Secure Vault (Documents)
  async getDocuments(): Promise<DocumentFile[]> {
    const res = await fetch(`${API_BASE}/api/documents`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  async createDocument(data: Partial<DocumentFile>): Promise<DocumentFile> {
    const res = await fetch(`${API_BASE}/api/documents`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to secure document");
    return res.json();
  },

  async updateDocument(id: string, data: Partial<DocumentFile>): Promise<DocumentFile> {
    const res = await fetch(`${API_BASE}/api/documents/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to edit document");
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/documents/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete document");
  },

  // AI Stories
  async getStories(): Promise<AIStory[]> {
    const res = await fetch(`${API_BASE}/api/stories`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch legacy biographies");
    return res.json();
  },

  async generateStory(biographyLength: 'short' | 'medium' | 'biography', personalNotes?: string): Promise<AIStory> {
    const res = await fetch(`${API_BASE}/api/story/generate`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ biographyLength, personalNotes })
    });
    if (!res.ok) throw new Error("Failed to generate biography book");
    return res.json();
  },

  async deleteStory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/stories/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete biography");
  },

  // AI Chat Companion
  async getChatHistory(): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/api/chat/history`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch chat history");
    return res.json();
  },

  /** One AI-companion turn; `language` is a BCP-47 tag from src/languages.ts. */
  async sendMessage(message: string, language?: string): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ message, language })
    });
    if (!res.ok) throw new Error("Failed to send message to AI companion");
    return res.json();
  },

  async clearChatHistory(): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/api/chat/history`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to clear chat history");
    const data = await res.json();
    return data.history;
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetch(`${API_BASE}/api/notifications`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },

  async markNotificationRead(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "PUT",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
  },

  async clearAllNotifications(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/notifications/clear`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to clear notifications");
  },

  // Global Search
  async globalSearch(q: string): Promise<{
    memories: Memory[];
    milestones: Milestone[];
    documents: DocumentFile[];
    family: FamilyMember[];
    messages: LegacyMessage[];
  }> {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Search request failed");
    return res.json();
  },

  // Settings
  async updateProfile(data: { name: string, email: string, dob: string, phone?: string, profilePhoto?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/api/settings/profile`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Profile update failed");
    }
    return res.json();
  },

  async regenerateLegacyKey(): Promise<{ legacyKey: string }> {
    const res = await fetch(`${API_BASE}/api/settings/legacy-key/regenerate`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to regenerate legacy key");
    }
    return res.json();
  },

  async changePassword(data: any): Promise<void> {
    const res = await fetch(`${API_BASE}/api/settings/password`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Password change failed");
    }
  },

  async deleteAccount(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/settings/account`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete account");
    this.clearSession();
  },

  async getEmailConfig(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/settings/email-config`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load email configurations");
    return res.json();
  },

  async sendTestEmail(to: string): Promise<{ success: boolean; messageId?: string }> {
    const res = await fetch(`${API_BASE}/api/settings/email-config/test`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ to })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Test email failed to send");
    }
    return res.json();
  },

  async updateEmailConfig(config: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/settings/email-config`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update email configurations");
    }
    return res.json();
  },

  // Google Flow AI Video Generator
  async generateVideoScript(tonePreset?: string, customPrompt?: string): Promise<{
    title: string;
    musicTrack: string;
    durationSeconds: number;
    scenes: Array<{
      title: string;
      narration: string;
      visualCue: string;
      duration: number;
      mediaUrl?: string;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/api/video/generate`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ tonePreset, customPrompt })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Video script generation failed");
    }
    return res.json();
  },

  // ==================== SAAS SUBSCRIPTION & MONETIZATION API CLIENT ====================
  async getCurrentSubscription(): Promise<{
    subscription: any;
    storageUsedGB: number;
    storageLimitGB: number;
    storagePercentage: number;
    planTier: string;
    role: string;
    autoRenew: boolean;
  }> {
    const res = await fetch(`${API_BASE}/api/subscription/current`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch subscription details");
    return res.json();
  },

  async upgradeSubscription(planTier: string, paymentMethod?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/subscription/upgrade`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ planTier, paymentMethod })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to upgrade subscription");
    }
    return res.json();
  },

  async cancelSubscription(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/subscription/cancel`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to cancel subscription auto-renew");
    return res.json();
  },

  async switchUserRole(role: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/user/role`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ role })
    });
    if (!res.ok) throw new Error("Failed to update user role");
    return res.json();
  },

  async getFamilyWorkspace(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/family-workspace`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load family workspace");
    return res.json();
  },

  async inviteFamilyMember(email: string, role: string, familyName?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/family-workspace/invite`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email, role, familyName })
    });
    if (!res.ok) throw new Error("Failed to send family invitation");
    return res.json();
  },

  async getOrganizationWorkspace(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/organization/workspace`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load organization workspace");
    return res.json();
  },

  async createOrgDepartment(orgId: string, name: string, headName: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/organization/department`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ orgId, name, headName })
    });
    if (!res.ok) throw new Error("Failed to create organization department");
    return res.json();
  },

  async createOrgEvent(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/organization/event`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to add organization event");
    return res.json();
  },

  async getAdvertisements(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/ads`, {
      headers: getHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async createAdvertisement(adData: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/ads`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(adData)
    });
    if (!res.ok) throw new Error("Failed to create advertisement");
    return res.json();
  },

  async trackAdClick(adId: string): Promise<void> {
    fetch(`${API_BASE}/api/ads/${adId}/click`, { method: "POST" }).catch(() => {});
  },

  async trackAdView(adId: string): Promise<void> {
    fetch(`${API_BASE}/api/ads/${adId}/view`, { method: "POST" }).catch(() => {});
  },

  async getBillingSummary(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/billing/summary`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load billing summary");
    return res.json();
  },

  /* ================= AUTOBIOGRAPHY ================= */

  async getAutobiography(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/autobiography`, { headers: getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't open your autobiography. Please try again.");
    }
    return res.json();
  },

  async generateAutobiography(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/autobiography/generate`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok && res.status !== 202 && res.status !== 409) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't start writing right now. Please try again.");
    }
  },

  async regenerateChapter(chapterId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/autobiography/chapters/${encodeURIComponent(chapterId)}/regenerate`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't rewrite that chapter. Please try again.");
    }
  },

  async updateChapter(chapterId: string, patch: { title?: string; subtitle?: string; sections?: string[]; captions?: Record<string, string> }): Promise<any> {
    const res = await fetch(`${API_BASE}/api/autobiography/chapters/${encodeURIComponent(chapterId)}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't save your changes. Please try again.");
    }
    return res.json();
  },

  async publishAutobiography(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/autobiography/publish`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't share your story. Please try again.");
    }
    return res.json();
  },

  async unpublishAutobiography(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/autobiography/unpublish`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "We couldn't update sharing. Please try again.");
    }
    return res.json();
  },

  /** Translated copy of the finished autobiography (server caches per language). */
  async getAutobiographyTranslation(langCode: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/autobiography/translate?lang=${encodeURIComponent(langCode)}`, { headers: getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Translation failed. Please try again.");
    }
    return res.json();
  }
};

