import React, { useState, useEffect } from "react";
import { 
  Users, HardDrive, Image, Calendar, Shield, Activity, Mail, 
  Plus, CheckCircle, Clock, ChevronRight, UserPlus, Heart, FileText, Lock
} from "lucide-react";
import { api } from "../api";
import { User, FamilyGroup } from "../types";

interface FamilyDashboardProps {
  user: User;
  onNavigateToMemories?: () => void;
}

export default function FamilyDashboard({ user, onNavigateToMemories }: FamilyDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");
  const [family, setFamily] = useState<FamilyGroup | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  useEffect(() => {
    loadFamilyWorkspace();
  }, []);

  const loadFamilyWorkspace = async () => {
    setLoading(true);
    try {
      const data = await api.getFamilyWorkspace();
      setFamily(data);
    } catch (err) {
      console.error("Failed to load family workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await api.inviteFamilyMember(inviteEmail, inviteRole, family?.familyName);
      setFamily(res.family);
      setInviteSuccess(true);
      setInviteEmail("");
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "We couldn't send that invitation. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[#8A8F8B] uppercase tracking-widest animate-pulse">
        Loading Family Vault Workspace...
      </div>
    );
  }

  const membersCount = family?.members?.length || 1;
  const totalStorageGB = family?.totalStorageGB || 100;
  const usedStorageGB = family?.usedStorageGB || 34.2;
  const percentage = Math.min(100, Math.round((usedStorageGB / totalStorageGB) * 100));

  return (
    <div id="family-dashboard" className="space-y-8 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="p-8 bg-gradient-to-r from-[#F1EFEC] via-[#E2EBE4] to-[#EFE9DD] border border-[#AAA0C9]/40 rounded-[16px] shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#AAA0C9]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[9px] font-mono font-medium uppercase tracking-[0.15em] bg-[#AAA0C9] text-white">
              👨‍👩‍👧 Family Subscription Workspace
            </span>
            <span className="px-2 py-1 text-[9px] font-mono font-medium uppercase tracking-[0.12em] bg-[#E5E5E1] text-[#C4B5FD]">
              100 GB Shared Cloud Storage
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-[#1E2521]">
            {family?.familyName || "The Family Heritage Vault"}
          </h1>

          <p className="text-xs text-[#454A46] max-w-2xl leading-relaxed">
            Preserve your family's memories together in one secure place. Co-create albums, view shared timelines, manage access roles, and archive generations of family stories.
          </p>
        </div>

        {/* Quick Invite Widget */}
        <form onSubmit={handleSendInvite} className="relative z-10 p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] space-y-2 min-w-[280px]">
          <span className="text-[10px] font-mono text-[#C4B5FD] uppercase font-medium flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Quick Member Invite
          </span>
          <div className="flex gap-2">
            <input 
              type="email"
              placeholder="family.member@gmail.com" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-3 py-1.5 bg-[#F1EFEC] border border-[#E5E5E1] text-xs text-[#1E2521] font-mono focus:border-[#AAA0C9] outline-none flex-grow"
              required
            />
            <button 
              type="submit" 
              disabled={inviting}
              className="px-3 py-1.5 bg-[#AAA0C9] hover:bg-[#7C3AED] text-white text-xs font-medium uppercase tracking-[0.12em] cursor-pointer"
            >
              {inviting ? "Sending..." : "Invite"}
            </button>
          </div>
          {inviteSuccess && (
            <p className="text-[10px] text-[#4E7A64] font-mono font-bold">Invitation sent successfully!</p>
          )}
        </form>
      </div>

      {/* Storage Meter Summary Bar */}
      <div className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#AAA0C9]/10 text-[#AAA0C9] border border-[#AAA0C9]/30">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium uppercase tracking-[0.12em] text-[#1E2521]">Shared Storage Meter</h4>
            <p className="text-xs text-[#454A46]">Pooled family quota shared among all active members</p>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#454A46]">{usedStorageGB} GB Used</span>
            <span className="text-[#AAA0C9] font-bold">{totalStorageGB} GB Total Cap</span>
          </div>
          <div className="w-full h-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] overflow-hidden">
            <div className="h-full bg-[#AAA0C9] transition-all duration-700" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#E5E5E1] overflow-x-auto gap-1">
        {[
          { id: "overview", label: "Overview & Members", icon: <Users className="w-4 h-4" /> },
          { id: "timeline", label: "Family Timeline", icon: <Calendar className="w-4 h-4" /> },
          { id: "albums", label: "Shared Albums", icon: <Image className="w-4 h-4" /> },
          { id: "activities", label: "Activity Feed", icon: <Activity className="w-4 h-4" /> },
          { id: "invites", label: "Invitation Management", icon: <Mail className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === tab.id 
                ? "bg-[#AAA0C9] text-white" 
                : "text-[#454A46] hover:bg-[#F1EFEC] hover:text-[#1E2521]"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Overview & Family Members */}
      {activeSubTab === "overview" && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#AAA0C9]" />
              <span>Family Members &amp; Permissions ({membersCount})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(family?.members || []).map((member) => (
              <div key={member.id} className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] space-y-4 relative group">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FCFBF7] border border-[#AAA0C9] flex items-center justify-center font-serif text-lg font-bold text-[#AAA0C9]">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E2521]">{member.name}</h4>
                    <span className="text-[10px] font-mono text-[#AAA0C9] font-semibold">{member.relationship}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-[#E5E5E1] text-xs text-[#454A46]">
                  <p><strong className="text-[#454A46]">Email:</strong> {member.email}</p>
                  <p><strong className="text-[#454A46]">Role:</strong> {member.role || "Family Member"}</p>
                  <p><strong className="text-[#454A46]">Joined:</strong> {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "Active Session"}</p>
                </div>

                <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-[#4E7A64]">
                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Permission: {member.permission || "editor"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 2: Family Timeline */}
      {activeSubTab === "timeline" && (
        <div className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-4">
            <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521]">Shared Family Timeline</h3>
            <span className="text-xs text-[#454A46]">Chronological cross-generational milestones</span>
          </div>

          <div className="space-y-4">
            {[
              { date: "1975", title: "Grandparents' Wedding Ceremony", desc: "Ancestral estate celebration archived in high-res film restore." },
              { date: "1998", title: "Family Estate Acquisition", desc: "Original deed records and inaugural housewarming video notes." },
              { date: "2006", title: "Rohit & Deekshitha Wedding", desc: "First digital archive ledger entry created." },
              { date: "2026", title: "Golden Jubilee Reunion", desc: "Scheduled full family gathering and digital biography release." }
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-[#FCFBF7] border border-[#E5E5E1] flex items-start gap-4">
                <span className="px-3 py-1 bg-[#AAA0C9] text-white text-xs font-mono font-bold">{item.date}</span>
                <div>
                  <h4 className="text-sm font-semibold text-[#1E2521]">{item.title}</h4>
                  <p className="text-xs text-[#454A46] mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 3: Shared Albums */}
      {activeSubTab === "albums" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521]">Collaborative Shared Albums</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(family?.albums || []).map((album) => (
              <div key={album.id} className="bg-[#F1EFEC] border border-[#E5E5E1] overflow-hidden group">
                <div className="h-48 relative overflow-hidden bg-[#FCFBF7]">
                  <img 
                    src={album.coverImage} 
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#FCFBF7]/80 border border-[#E5E5E1] text-xs font-mono text-[#315C4A]">
                    {album.photosCount} Photos preserved
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h4 className="text-base font-serif font-bold text-[#1E2521]">{album.title}</h4>
                  <p className="text-xs text-[#454A46]">{album.description}</p>
                  <p className="text-[10px] font-mono text-[#8A8F8B]">Created by: {album.createdByName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: Activity Feed */}
      {activeSubTab === "activities" && (
        <div className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] space-y-4">
          <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521]">Family Activity Log</h3>
          
          <div className="space-y-3">
            {(family?.activities || []).map((act) => (
              <div key={act.id} className="p-3 bg-[#FCFBF7] border border-[#E5E5E1] flex items-center justify-between text-xs text-[#454A46]">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-[#AAA0C9]" />
                  <div>
                    <span className="font-bold text-[#1E2521]">{act.userName}</span> ({act.userRole}): {act.action}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#8A8F8B]">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 5: Invitation Management */}
      {activeSubTab === "invites" && (
        <div className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] space-y-6">
          <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521]">Pending &amp; Sent Invitations</h3>
          
          <div className="space-y-3">
            {(family?.invitations || []).map((inv) => (
              <div key={inv.id} className="p-4 bg-[#FCFBF7] border border-[#E5E5E1] flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-[#1E2521]">{inv.email}</p>
                  <p className="text-[10px] text-[#454A46]">Role: {inv.role} • Sent: {new Date(inv.sentAt).toLocaleDateString()}</p>
                </div>
                <span className="px-2.5 py-1 bg-[#315C4A]/10 text-[#315C4A] border border-[#315C4A]/30 text-[10px] font-mono uppercase">
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
