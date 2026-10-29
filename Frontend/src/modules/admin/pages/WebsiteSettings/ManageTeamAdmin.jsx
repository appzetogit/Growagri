import React, { useState, useEffect, useMemo } from "react";
import {
  FiUsers,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiUpload,
  FiUser,
  FiCheck,
  FiX,
  FiEye,
  FiEyeOff,
  FiLinkedin,
  FiTwitter,
  FiMail,
  FiArrowUp,
  FiArrowDown,
  FiRefreshCw,
  FiAlertTriangle,
  FiGlobe
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../../components/CardShell";
import Modal from "../../components/Modal";
import websiteService from "../../services/websiteService";
import LogoLoader from "../../../../components/common/LogoLoader";
import API from "../../../../services/api";

const ROLE_SUGGESTIONS = [
  "Founder & CEO",
  "Co-Founder",
  "Designated Partner",
  "Chief Technology Officer (CTO)",
  "Chief Operating Officer (COO)",
  "Head of Agriculture Operations",
  "Lead Agronomist",
  "Product Manager",
  "Business Development Lead",
  "Customer Success Manager"
];

const ManageTeamAdmin = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "active", "inactive"
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialFormState = {
    name: "",
    role: "",
    image: "",
    bio: "",
    order: 0,
    isActive: true,
    socialLinks: {
      linkedin: "",
      twitter: "",
      email: ""
    }
  };

  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const res = await websiteService.getTeamMembers();
      if (res.data?.success) {
        setTeamMembers(res.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setForm({
      ...initialFormState,
      order: teamMembers.length + 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingId(member._id);
    setForm({
      name: member.name || "",
      role: member.role || "",
      image: member.image || "",
      bio: member.bio || "",
      order: member.order ?? 0,
      isActive: member.isActive ?? true,
      socialLinks: {
        linkedin: member.socialLinks?.linkedin || "",
        twitter: member.socialLinks?.twitter || "",
        email: member.socialLinks?.email || ""
      }
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Uploading team member image...");
    try {
      setUploading(true);
      let uploadedUrl = "";

      // 1. Try dedicated endpoint
      try {
        const res = await websiteService.uploadTeamMemberImage(formData);
        if (res.data?.success && res.data?.imageUrl) {
          uploadedUrl = res.data.imageUrl;
        }
      } catch (err) {
        console.warn("Dedicated team upload endpoint failed, falling back to /upload...", err);
      }

      // 2. Try generic /upload
      if (!uploadedUrl) {
        const res = await API.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (res.data?.success && res.data?.imageUrl) {
          uploadedUrl = res.data.imageUrl;
        }
      }

      if (uploadedUrl) {
        setForm((prev) => ({ ...prev, image: uploadedUrl }));
        toast.success("Image uploaded successfully!", { id: toastId });
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image. You can also paste an image URL directly.", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Please enter the team member's name");
      return;
    }
    if (!form.role.trim()) {
      toast.error("Please enter the member's role or designation");
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        const res = await websiteService.updateTeamMember(editingId, form);
        if (res.data?.success) {
          toast.success("Team member updated successfully!");
          setIsModalOpen(false);
          fetchTeamMembers();
        }
      } else {
        const res = await websiteService.createTeamMember(form);
        if (res.data?.success) {
          toast.success("Team member added successfully!");
          setIsModalOpen(false);
          fetchTeamMembers();
        }
      }
    } catch (error) {
      console.error("Submit team member error:", error);
      toast.error(error.response?.data?.message || "Failed to save team member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      const updatedStatus = !member.isActive;
      // Optimistic update
      setTeamMembers((prev) =>
        prev.map((m) => (m._id === member._id ? { ...m, isActive: updatedStatus } : m))
      );

      const res = await websiteService.updateTeamMember(member._id, {
        isActive: updatedStatus
      });

      if (res.data?.success) {
        toast.success(`Member set to ${updatedStatus ? "Active" : "Hidden"}`);
      } else {
        fetchTeamMembers(); // Revert
      }
    } catch (error) {
      console.error("Toggle status error:", error);
      toast.error("Failed to update status");
      fetchTeamMembers();
    }
  };

  const confirmDelete = (member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;
    try {
      const res = await websiteService.deleteTeamMember(memberToDelete._id);
      if (res.data?.success) {
        toast.success("Team member removed successfully");
        setIsDeleteModalOpen(false);
        setMemberToDelete(null);
        fetchTeamMembers();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete team member");
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const matchesSearch =
        m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.bio?.toLowerCase().includes(searchTerm.toLowerCase());

      if (statusFilter === "active") return matchesSearch && m.isActive;
      if (statusFilter === "inactive") return matchesSearch && !m.isActive;
      return matchesSearch;
    });
  }, [teamMembers, searchTerm, statusFilter]);

  const activeCount = useMemo(() => teamMembers.filter((m) => m.isActive).length, [teamMembers]);
  const inactiveCount = useMemo(() => teamMembers.filter((m) => !m.isActive).length, [teamMembers]);

  if (loading) {
    return <LogoLoader message="Loading Team Members..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / CardShell */}
      <CardShell
        icon={FiUsers}
        title="Manage Team Members"
        subtitle="Manage leadership, key team members, their roles, and photos displayed on the user website"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeCount} Active on Website
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
              {inactiveCount} Hidden
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Total: {teamMembers.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTeamMembers}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
              title="Refresh List"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold text-sm shadow-sm shadow-emerald-500/20 hover:shadow-md transition-all active:scale-95"
            >
              <FiPlus className="w-4 h-4" />
              Add Team Member
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, role or bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {["all", "active", "inactive"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all capitalize ${
                  statusFilter === status
                    ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </CardShell>

      {/* Team Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <FiUsers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No team members found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search query or filter options."
              : "Get started by adding your leadership and core team members to show on the website."}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all"
          >
            <FiPlus className="w-4 h-4" />
            Add First Team Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredMembers.map((member) => (
            <div
              key={member._id}
              className={`group bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                member.isActive
                  ? "border-gray-200 hover:border-emerald-300"
                  : "border-gray-200 bg-gray-50/70 opacity-80"
              }`}
            >
              {/* Card Top: Image & Status */}
              <div className="p-5 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500/20 shadow-inner bg-gradient-to-tr from-emerald-100 to-green-50 flex items-center justify-center">
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "";
                        }}
                      />
                    ) : (
                      <FiUser className="w-10 h-10 text-emerald-600" />
                    )}
                  </div>
                  {/* Order Badge */}
                  <span
                    className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-gray-900 text-white text-[10px] font-black flex items-center justify-center shadow"
                    title={`Display Order: ${member.order}`}
                  >
                    #{member.order ?? 0}
                  </span>
                  {/* Status indicator */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                      member.isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                    title={member.isActive ? "Active on site" : "Hidden"}
                  >
                    {member.isActive ? (
                      <FiCheck className="w-3 h-3 text-white" />
                    ) : (
                      <FiX className="w-3 h-3 text-white" />
                    )}
                  </span>
                </div>

                {/* Name & Role */}
                <h4 className="text-base font-bold text-gray-900 mb-1 leading-snug line-clamp-1">
                  {member.name}
                </h4>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                  {member.role}
                </div>

                {/* Bio */}
                {member.bio ? (
                  <p className="text-xs text-gray-600 line-clamp-2 italic mb-3">
                    "{member.bio}"
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3">No bio added</p>
                )}

                {/* Social Links */}
                <div className="flex items-center gap-2 text-gray-400 mt-auto">
                  {member.socialLinks?.linkedin && (
                    <a
                      href={member.socialLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="LinkedIn"
                    >
                      <FiLinkedin className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {member.socialLinks?.twitter && (
                    <a
                      href={member.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:text-sky-500 hover:bg-sky-50 transition-colors"
                      title="Twitter / X"
                    >
                      <FiTwitter className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {member.socialLinks?.email && (
                    <a
                      href={`mailto:${member.socialLinks.email}`}
                      className="p-1.5 rounded-lg hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Email"
                    >
                      <FiMail className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {!member.socialLinks?.linkedin && !member.socialLinks?.twitter && !member.socialLinks?.email && (
                    <span className="text-[10px] text-gray-400">No socials</span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    member.isActive
                      ? "text-emerald-700 hover:bg-emerald-100/50"
                      : "text-gray-500 hover:bg-gray-200/50"
                  }`}
                  title={member.isActive ? "Click to hide from website" : "Click to show on website"}
                >
                  {member.isActive ? (
                    <>
                      <FiEye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Visible</span>
                    </>
                  ) : (
                    <>
                      <FiEyeOff className="w-3.5 h-3.5 text-gray-400" />
                      <span>Hidden</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(member)}
                    className="p-1.5 rounded-lg hover:bg-white text-gray-600 hover:text-emerald-600 transition-colors border border-transparent hover:border-gray-200"
                    title="Edit Member"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => confirmDelete(member)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors border border-transparent hover:border-red-200"
                    title="Delete Member"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title={editingId ? "Edit Team Member" : "Add New Team Member"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo Upload Section */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Member Profile Photo
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-white border-2 border-emerald-400 shadow-md flex items-center justify-center">
                  {form.image ? (
                    <img
                      src={form.image}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FiUser className="w-10 h-10 text-gray-300" />
                  )}
                </div>
                {form.image && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image: "" }))}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow"
                    title="Remove Image"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-300 cursor-pointer shadow-sm transition-colors active:scale-95">
                    <FiUpload className="w-4 h-4" />
                    <span>{uploading ? "Uploading..." : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-[11px] text-gray-400">JPG, PNG or WebP up to 5MB</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Or paste image URL:</span>
                  <input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={form.image}
                    onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                    className="flex-1 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Chinmay Anand"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Role / Designation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Founder & CEO"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Quick Role Suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-gray-500 mr-2">Quick Suggestions:</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ROLE_SUGGESTIONS.map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setForm((prev) => ({ ...prev, role }))}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    form.role === role
                      ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Display Order & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Display Order
              </label>
              <input
                type="number"
                min="0"
                value={form.order}
                onChange={(e) => setForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="1 (lower numbers appear first)"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Order priority (1 appears before 2)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Visibility Status
              </label>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    form.isActive ? "bg-emerald-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      form.isActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-gray-700">
                  {form.isActive ? "Active (Visible on website)" : "Hidden (Draft)"}
                </span>
              </div>
            </div>
          </div>

          {/* Bio / Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Short Bio / Description <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Transforming agriculture through technology and farmer empowerment."
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">
              Social Links <span className="text-gray-400 font-normal">(Optional)</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <FiLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="url"
                  placeholder="LinkedIn profile URL"
                  value={form.socialLinks.linkedin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
                    }))
                  }
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="relative">
                <FiTwitter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="url"
                  placeholder="Twitter / X profile URL"
                  value={form.socialLinks.twitter}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                    }))
                  }
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={form.socialLinks.email}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, email: e.target.value }
                    }))
                  }
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingId ? "Update Member" : "Add Member"}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Remove Team Member"
        size="sm"
      >
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <FiAlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900 mb-1">
              Delete "{memberToDelete?.name}"?
            </h4>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              This action cannot be undone. This member will be permanently removed from the website team roster.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm transition-all"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageTeamAdmin;
