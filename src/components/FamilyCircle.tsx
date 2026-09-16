import React, { useState, useEffect } from "react";
import { FamilyMember } from "../types";
import { api } from "../api";
import { 
  Users, Plus, Mail, Phone, Calendar, ShieldAlert, Edit, Trash2, X, 
  Loader, AlertCircle, Share2, Clipboard, ArrowRight, GitBranch, Heart
} from "lucide-react";

interface FamilyCircleProps {
  onFamilyChanged: () => void;
  guestMode?: boolean;
}

export default function FamilyCircle({ onFamilyChanged, guestMode }: FamilyCircleProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvitationToast, setShowInvitationToast] = useState(false);

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<any>("Child");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState<any>("Viewer");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFamily();
  }, []);

  const fetchFamily = async () => {
    setLoading(true);
    try {
      const data = await api.getFamily();
      setMembers(data);
    } catch (err: any) {
      setError(err.message || "We couldn't open your family circle. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingMember(null);
    setName("");
    setRelationship("Child");
    setEmail("");
    setPhone("");
    setDob("");
    setRole("Viewer");
    setProfilePhoto("");
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (member: FamilyMember) => {
    setEditingMember(member);
    setName(member.name);
    setRelationship(member.relationship);
    setEmail(member.email);
    setPhone(member.phone || "");
    setDob(member.dob || "");
    setRole(member.role);
    setProfilePhoto(member.profilePhoto || "");
    setError("");
    setIsFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const result = await api.uploadFile(file.name, base64Data, "image");
      setProfilePhoto(result.url);
    } catch (err: any) {
      setError("We couldn't upload that photo. " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !relationship || !email) {
      setError("Name, Relationship, and Email are required.");
      return;
    }

    const payload = {
      name,
      relationship,
      email,
      phone,
      dob,
      role,
      permission: role,
      profilePhoto
    };

    try {
      if (editingMember) {
        await api.updateFamilyMember(editingMember.id, payload);
      } else {
        await api.createFamilyMember(payload);
      }
      setIsFormOpen(false);
      fetchFamily();
      onFamilyChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't add that family member. Please check the details and try again.");
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm("Remove this relative from your LifeBook circle?")) return;
    try {
      await api.deleteFamilyMember(id);
      fetchFamily();
      onFamilyChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't remove that family member. Please try again.");
    }
  };

  const copyInvitationText = (member: FamilyMember) => {
    const text = `Hi ${member.name}, \n\nI have created a Legacy Circle invitation for you on LifeBook. You can log in and view my memories, timelines, and locked capsules.\n\nAccess Link: https://lifebook.aistudio.dev/auth?invite=${member.id}\nYour Role: ${member.role || member.permission}`;
    navigator.clipboard.writeText(text);
    setShowInvitationToast(true);
    setTimeout(() => setShowInvitationToast(false), 3000);
  };

  // Organize family members into structural generation branches for the Visual Family Tree
  const selfUser = { id: "self", name: "You (Me)", relationship: "Self", profilePhoto: "" };
  
  const grandparents = members.filter(m => ["Grandparent", "Grandmother", "Grandfather"].includes(m.relationship));
  const parents = members.filter(m => ["Parent", "Mother", "Father"].includes(m.relationship));
  const spouses = members.filter(m => ["Spouse", "Husband", "Wife", "Partner"].includes(m.relationship));
  const siblings = members.filter(m => ["Sibling", "Brother", "Sister"].includes(m.relationship));
  const children = members.filter(m => ["Child", "Son", "Daughter"].includes(m.relationship));
  const grandchildren = members.filter(m => ["Grandchild", "Grandson", "Granddaughter"].includes(m.relationship));
  const others = members.filter(m => !["Grandparent", "Grandmother", "Grandfather", "Parent", "Mother", "Father", "Spouse", "Husband", "Wife", "Partner", "Sibling", "Brother", "Sister", "Child", "Son", "Daughter", "Grandchild", "Grandson", "Granddaughter"].includes(m.relationship));

  return (
    <div id="family-root" className="space-y-8 animate-fade-in font-sans">
      <div id="family-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#1A1A1A]" />
            <span>Family Circle &amp; Legacy Tree</span>
          </h2>
          <p className="text-[#454A46] text-xs">Maintain communication contacts, grant viewing capabilities, and automatically generate family charts.</p>
        </div>
        {!guestMode && (
          <button
            id="add-relative-btn"
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white text-xs font-medium uppercase tracking-[0.12em] rounded-[16px] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Relative</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showInvitationToast && (
        <div className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-[16px] text-xs flex items-center gap-2 font-serif italic">
          <span>✓ Invitation message and access link copied to your clipboard! Send it to your relative.</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#454A46] gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Generating relationship chart...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Visual Nodes-Based Family Tree Section */}
          <div id="visual-family-tree" className="p-6 rounded-[16px] bg-white border border-[#E5E5E1] space-y-6 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#1A1A1A]" />
                <span>Automatic Legacy Pedigree</span>
              </h3>
              <span className="text-[9px] text-[#8A8F8B] font-medium uppercase tracking-[0.12em] font-mono">Dynamic Generation Chart</span>
            </div>

            <div className="flex flex-col items-center justify-center space-y-6 py-6 overflow-x-auto min-w-full">
              {/* Generation 0: Grandparents */}
              {grandparents.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="flex gap-4">
                    {grandparents.map(gp => (
                      <div key={gp.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                        <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                          {gp.profilePhoto ? <img src={gp.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : gp.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{gp.name}</p>
                          <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{gp.relationship}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="w-[1px] h-6 bg-[#E5E5E1]"></div>
                </div>
              )}

              {/* Generation 1: Parents */}
              {parents.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="flex gap-4">
                    {parents.map(p => (
                      <div key={p.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                        <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                          {p.profilePhoto ? <img src={p.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : p.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{p.name}</p>
                          <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{p.relationship}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Stem line down */}
                  <div className="w-[1px] h-6 bg-[#E5E5E1]"></div>
                </div>
              )}

              {/* Generation 2: Self, Spouse, Siblings */}
              <div className="flex flex-col items-center">
                {(parents.length > 0 || grandparents.length > 0) && <div className="w-[1px] h-2 bg-[#E5E5E1]"></div>}
                <div className="flex flex-wrap justify-center gap-4">
                  {/* Me Node */}
                  <div className="p-3 bg-[#315C4A] border border-[#315C4A] rounded-[16px] flex items-center gap-3 w-44 text-white">
                    <div className="w-8 h-8 rounded-[16px] bg-white text-[#1A1A1A] flex items-center justify-center text-xs font-semibold">
                      ME
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Owner Account</p>
                      <p className="text-[10px] text-white/70 uppercase tracking-wider font-mono">Biography Core</p>
                    </div>
                  </div>

                  {/* Spouses */}
                  {spouses.map(s => (
                    <div key={s.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                      <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                        {s.profilePhoto ? <img src={s.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : s.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{s.name}</p>
                        <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{s.relationship}</p>
                      </div>
                    </div>
                  ))}

                  {/* Siblings */}
                  {siblings.map(sib => (
                    <div key={sib.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                      <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                        {sib.profilePhoto ? <img src={sib.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : sib.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{sib.name}</p>
                        <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{sib.relationship}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {children.length > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-[1px] h-6 bg-[#E5E5E1]"></div>
                  </div>
                )}
              </div>

              {/* Generation 3: Children */}
              {children.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="flex gap-4">
                    {children.map(c => (
                      <div key={c.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                        <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                          {c.profilePhoto ? <img src={c.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : c.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{c.name}</p>
                          <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{c.relationship}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {grandchildren.length > 0 && (
                    <div className="flex flex-col items-center">
                      <div className="w-[1px] h-6 bg-[#E5E5E1]"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Generation 4: Grandchildren */}
              {grandchildren.length > 0 && (
                <div className="flex gap-4">
                  {grandchildren.map(gc => (
                    <div key={gc.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                      <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                        {gc.profilePhoto ? <img src={gc.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : gc.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{gc.name}</p>
                        <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{gc.relationship}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Extended Family & Circle */}
              {others.length > 0 && (
                <div className="flex flex-col items-center pt-2">
                  <span className="text-[9px] text-[#8A8F8B] font-medium uppercase tracking-[0.12em] font-mono mb-2">Extended Family &amp; Circle</span>
                  <div className="flex flex-wrap justify-center gap-4">
                    {others.map(o => (
                      <div key={o.id} className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 w-44">
                        <div className="w-8 h-8 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-xs font-medium uppercase">
                          {o.profilePhoto ? <img src={o.profilePhoto} className="w-full h-full rounded-[16px] object-cover" /> : o.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1A1A1A] truncate max-w-[120px]">{o.name}</p>
                          <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider">{o.relationship}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Members List Grid */}
          <div className="space-y-4">
            <h3 className="font-serif italic text-xl text-[#1A1A1A]">Circle Members Directory ({members.length})</h3>

            {members.length === 0 ? (
              <p className="text-xs text-[#454A46] font-sans">No registered family members. Add relatives and designate access permissions.</p>
            ) : (
              <div id="members-list-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {members.map(member => (
                  <div key={member.id} className="p-5 rounded-[16px] bg-white border border-[#E5E5E1] flex flex-col justify-between hover:border-[#315C4A] transition-all">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[16px] bg-[#F1EFEC] border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-sm font-semibold uppercase">
                          {member.profilePhoto ? (
                            <img src={member.profilePhoto} alt={member.name} className="w-full h-full object-cover rounded-[16px]" />
                          ) : member.name[0]}
                        </div>
                        <div>
                          <h4 className="font-serif italic text-lg text-[#1A1A1A]">{member.name}</h4>
                          <span className="text-[9px] px-2 py-0.5 bg-[#F1EFEC] text-[#1A1A1A] font-medium uppercase rounded-[16px] border border-[#E5E5E1] font-mono tracking-wider">
                            {member.relationship}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs font-sans">
                        <div className="flex items-center gap-2 text-[#454A46]">
                          <Mail className="w-3.5 h-3.5 text-[#8A8F8B]" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-2 text-[#454A46]">
                            <Phone className="w-3.5 h-3.5 text-[#8A8F8B]" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.dob && (
                          <div className="flex items-center gap-2 text-[#454A46]">
                            <Calendar className="w-3.5 h-3.5 text-[#8A8F8B]" />
                            <span className="font-mono">DOB: {new Date(member.dob).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-[#F1EFEC] rounded-[16px] border border-[#E5E5E1] text-xs flex justify-between items-center font-sans">
                        <span className="text-[#454A46]">Security Access Role:</span>
                        <span className="font-semibold text-[#1E2521] font-mono text-[9px] uppercase tracking-wider">{member.role}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E5E1]">
                      <button
                        onClick={() => copyInvitationText(member)}
                        className="text-xs text-[#1A1A1A] hover:underline font-medium uppercase tracking-[0.12em] text-[10px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Invite relative</span>
                      </button>

                      {!guestMode && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleOpenEditForm(member)}
                            className="p-1.5 hover:bg-[#F1EFEC] border border-transparent hover:border-[#E5E5E1] text-[#454A46] hover:text-[#1A1A1A] cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-1.5 hover:bg-[#F9EFEB] border border-transparent hover:border-[#E8CDC4] text-[#B4543E] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CRUD Relative Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-[#1A1A1A]">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-[16px] max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">
                {editingMember ? "Edit Relative Information" : "Connect New Relative"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#454A46] hover:text-[#1A1A1A] rounded-[10px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1 font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Relative Name</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Chloe Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] cursor-pointer font-medium uppercase tracking-[0.12em] text-[10px]"
                  >
                    <option value="Spouse">Spouse / Partner</option>
                    <option value="Child">Child (Son/Daughter)</option>
                    <option value="Grandchild">Grandchild</option>
                    <option value="Parent">Parent (Mother/Father)</option>
                    <option value="Grandparent">Grandparent (Grandmother/Grandfather)</option>
                    <option value="Sibling">Sibling (Brother/Sister)</option>
                    <option value="Friend">Friend / Companion</option>
                    <option value="Other">Other Family Relative</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Access Security Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] cursor-pointer font-medium uppercase tracking-[0.12em] text-[10px]"
                  >
                    <option value="Viewer">Viewer (Read-only memoirs)</option>
                    <option value="Contributor">Contributor (Can append memories)</option>
                    <option value="Editor">Editor (Can alter files)</option>
                    <option value="Admin">Administrator (Complete controls)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="chloe@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Upload Profile Photo</label>
                <div className="flex items-center gap-3">
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-4 py-2.5 rounded-[16px] flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold text-[#1A1A1A] transition-colors uppercase tracking-wider">
                    <Plus className="w-4 h-4 text-[#1A1A1A]" />
                    <span>Upload Portrait</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  {uploading && <span className="text-xs text-[#454A46] font-semibold animate-pulse">Saving...</span>}
                  {profilePhoto && (
                    <span className="text-[10px] text-[#3D5F4C] max-w-xs truncate font-mono font-bold">✓ Portrait Uploaded</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#E5E5E1] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 border border-[#E5E5E1] hover:bg-[#F1EFEC] bg-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer text-[#1A1A1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer"
                >
                  Add Relative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
