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
      alert(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[#64748B] uppercase tracking-widest animate-pulse">
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
      <div className="p-8 bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] border border-[#8B5CF6]/40 rounded-none shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest bg-[#8B5CF6] text-white">
              👨‍👩‍👧 Family Subscription Workspace
            </span>
            <span className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-[#334155] text-[#C4B5FD]">
              100 GB Shared Cloud Storage
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>
            {family?.familyName || "The Family Heritage Vault"}
          </h1>

          <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
            Preserve your family's memories together in one secure place. Co-create albums, view shared timelines, manage access roles, and archive generations of family stories.
          </p>
        </div>

        {/* Quick Invite Widget */}
        <form onSubmit={handleSendInvite} className="relative z-10 p-4 bg-[#0F172A] border border-[#334155] rounded-none space-y-2 min-w-[280px]">
          <span className="text-[10px] font-mono text-[#C4B5FD] uppercase font-bold flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Quick Member Invite
          </span>
          <div className="flex gap-2">
            <input 
              type="email"
              placeholder="family.member@gmail.com" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-3 py-1.5 bg-[#1E293B] border border-[#334155] text-xs text-[#F1F5F9] font-mono focus:border-[#8B5CF6] outline-none flex-grow"
              required
            />
            <button 
              type="submit" 
              disabled={inviting}
              className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {inviting ? "Sending..." : "Invite"}
            </button>
          </div>
          {inviteSuccess && (
            <p className="text-[10px] text-[#10B981] font-mono font-bold">Invitation sent successfully!</p>
          )}
        </form>
      </div>

      {/* Storage Meter Summary Bar */}
      <div className="p-6 bg-[#1E293B] border border-[#334155] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">Shared Storage Meter</h4>
            <p className="text-xs text-[#94A3B8]">Pooled family quota shared among all active members</p>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#94A3B8]">{usedStorageGB} GB Used</span>
            <span className="text-[#8B5CF6] font-bold">{totalStorageGB} GB Total Cap</span>
          </div>
          <div className="w-full h-2.5 bg-[#0F172A] border border-[#334155] rounded-none overflow-hidden">
            <div className="h-full bg-[#8B5CF6] transition-all duration-700" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#334155] overflow-x-auto gap-1">
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
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === tab.id 
                ? "bg-[#8B5CF6] text-white" 
                : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F1F5F9]"
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
            <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8B5CF6]" />
              <span>Family Members &amp; Permissions ({membersCount})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(family?.members || []).map((member) => (
              <div key={member.id} className="p-6 bg-[#1E293B] border border-[#334155] space-y-4 relative group">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#0F172A] border border-[#8B5CF6] flex items-center justify-center font-serif text-lg font-bold text-[#8B5CF6]">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#F1F5F9]">{member.name}</h4>
                    <span className="text-[10px] font-mono text-[#8B5CF6] font-semibold">{member.relationship}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-[#334155] text-xs text-[#94A3B8]">
                  <p><strong className="text-[#CBD5E1]">Email:</strong> {member.email}</p>
                  <p><strong className="text-[#CBD5E1]">Role:</strong> {member.role || "Family Member"}</p>
                  <p><strong className="text-[#CBD5E1]">Joined:</strong> {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "Active Session"}</p>
                </div>

                <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-[#10B981]">
                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Permission: {member.permission || "editor"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 2: Family Timeline */}
      {activeSubTab === "timeline" && (
        <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-6">
          <div className="flex items-center justify-between border-b border-[#334155] pb-4">
            <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9]">Shared Family Timeline</h3>
            <span className="text-xs text-[#94A3B8]">Chronological cross-generational milestones</span>
          </div>

          <div className="space-y-4">
            {[
              { date: "1975", title: "Grandparents' Wedding Ceremony", desc: "Ancestral estate celebration archived in high-res film restore." },
              { date: "1998", title: "Family Estate Acquisition", desc: "Original deed records and inaugural housewarming video notes." },
              { date: "2006", title: "Rohit & Deekshitha Wedding", desc: "First digital archive ledger entry created." },
              { date: "2026", title: "Golden Jubilee Reunion", desc: "Scheduled full family gathering and digital biography release." }
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-[#0F172A] border border-[#334155] flex items-start gap-4">
                <span className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-mono font-bold">{item.date}</span>
                <div>
                  <h4 className="text-sm font-bold text-[#F1F5F9]">{item.title}</h4>
                  <p className="text-xs text-[#94A3B8] mt-1">{item.desc}</p>
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
            <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9]">Collaborative Shared Albums</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(family?.albums || []).map((album) => (
              <div key={album.id} className="bg-[#1E293B] border border-[#334155] overflow-hidden group">
                <div className="h-48 relative overflow-hidden bg-[#0F172A]">
                  <img 
                    src={album.coverImage} 
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#0F172A]/80 border border-[#334155] text-xs font-mono text-[#F59E0B]">
                    {album.photosCount} Photos preserved
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h4 className="text-base font-serif font-bold text-[#F1F5F9]">{album.title}</h4>
                  <p className="text-xs text-[#94A3B8]">{album.description}</p>
                  <p className="text-[10px] font-mono text-[#64748B]">Created by: {album.createdByName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: Activity Feed */}
      {activeSubTab === "activities" && (
        <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-4">
          <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9]">Family Activity Log</h3>
          
          <div className="space-y-3">
            {(family?.activities || []).map((act) => (
              <div key={act.id} className="p-3 bg-[#0F172A] border border-[#334155] flex items-center justify-between text-xs text-[#CBD5E1]">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-[#8B5CF6]" />
                  <div>
                    <span className="font-bold text-[#F1F5F9]">{act.userName}</span> ({act.userRole}): {act.action}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 5: Invitation Management */}
      {activeSubTab === "invites" && (
        <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-6">
          <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9]">Pending &amp; Sent Invitations</h3>
          
          <div className="space-y-3">
            {(family?.invitations || []).map((inv) => (
              <div key={inv.id} className="p-4 bg-[#0F172A] border border-[#334155] flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-[#F1F5F9]">{inv.email}</p>
                  <p className="text-[10px] text-[#94A3B8]">Role: {inv.role} • Sent: {new Date(inv.sentAt).toLocaleDateString()}</p>
                </div>
                <span className="px-2.5 py-1 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 text-[10px] font-mono font-bold uppercase">
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
