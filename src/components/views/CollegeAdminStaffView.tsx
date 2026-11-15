import React, { useState, useMemo } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import { Profile } from '../../types';
import { Modal } from '../common/Modal';
import {
  Users,
  UserPlus,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  FlaskConical,
  RefreshCw,
  Power,
  Mail,
} from 'lucide-react';

export const CollegeAdminStaffView: React.FC = () => {
  const {
    institution,
    labAssistants,
    labs,
    departments,
    inviteLabAssistant,
    resendAssistantInvite,
    sendAssistantPasswordReset,
    updateProfileStatus,
    updateUserLabAssignments,
  } = useLabverse();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingAssignmentsUser, setEditingAssignmentsUser] = useState<Profile | null>(null);
  const [editingLabIds, setEditingLabIds] = useState<string[]>([]);

  // Invite Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [selectedLabIds, setSelectedLabIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const filteredAssistants = useMemo(() => {
    return labAssistants.filter((a) => {
      const s = a.status || 'active';
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        return (
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.identifier.toLowerCase().includes(q) ||
          (a.department_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [labAssistants, statusFilter, searchQuery]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await inviteLabAssistant({
        name,
        email,
        identifier,
        departmentId,
        assignedLabIds: selectedLabIds,
      });
      if (!res.success) {
        setFormError(res.error || 'Failed to create Lab Assistant.');
        return;
      }
      setIsInviteOpen(false);
      setName('');
      setEmail('');
      setIdentifier('');
      setSelectedLabIds([]);
      showNotice('success', res.message || `Lab Assistant account provisioned for ${email}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (user: Profile) => {
    const res = await resendAssistantInvite(user.id);
    if (!res.success) showNotice('error', res.error || 'Failed to resend invite.');
    else showNotice('success', res.message || `Invite resent to ${user.email}.`);
  };

  const handleResetPassword = async (user: Profile) => {
    const res = await sendAssistantPasswordReset(user.email);
    if (!res.success) showNotice('error', res.error || 'Failed to dispatch password reset.');
    else showNotice('success', `Password setup / reset email sent to ${user.email}.`);
  };

  const handleToggleSuspend = async (user: Profile) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const res = await updateProfileStatus(user.id, nextStatus);
    if (!res.success) showNotice('error', res.error || 'Status update failed.');
    else showNotice('success', `${user.name} account status set to ${nextStatus}.`);
  };

  const handleSaveAssignments = async () => {
    if (!editingAssignmentsUser) return;
    const res = await updateUserLabAssignments(editingAssignmentsUser.id, editingLabIds);
    if (!res.success) {
      showNotice('error', res.error || 'Failed to update assignments.');
      return;
    }
    showNotice('success', `Updated laboratory assignments for ${editingAssignmentsUser.name}.`);
    setEditingAssignmentsUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-xl text-[#252521]">
            Lab Assistant Management
          </h1>
          <p className="text-xs text-[#6E675F] mt-0.5">
            Create Lab Assistant accounts, manage access status, and assign specific {institution.code} laboratories.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsInviteOpen(true);
          }}
          className="px-4 py-2 text-xs font-bold bg-[#49372E] hover:bg-[#A66A43] text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Lab Assistant</span>
        </button>
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Total Lab Assistants</span>
            <Users className="w-4 h-4 text-[#A66A43]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#252521] mt-2">{labAssistants.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Active Accounts</span>
            <CheckCircle2 className="w-4 h-4 text-[#2E6F4E]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2E6F4E] mt-2">
            {labAssistants.filter((a) => (a.status || 'active') === 'active').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Pending Invitations</span>
            <Mail className="w-4 h-4 text-[#D99022]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#D99022] mt-2">
            {labAssistants.filter((a) => a.status === 'invited').length}
          </div>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E7DDD0] bg-[#FAF6F0]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E675F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assistant name, email, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs"
            />
          </div>

          <select
            aria-label="Filter Assistants by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-[#D8CBB9] text-xs rounded-xl px-3 py-2 text-[#252521]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="invited">Pending Invite</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4">Lab Assistant</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Assigned Laboratories</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F0E8]">
              {filteredAssistants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#6E675F]">
                    No Lab Assistants found.
                  </td>
                </tr>
              ) : (
                filteredAssistants.map((assistant) => {
                  const status = assistant.status || 'active';
                  const assignedLabs = labs.filter((l) => assistant.assigned_lab_ids?.includes(l.id));
                  return (
                    <tr key={assistant.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#252521]">{assistant.name}</div>
                        <div className="font-mono text-[11px] text-[#A66A43]">{assistant.identifier}</div>
                        <div className="text-[11px] text-[#6E675F]">{assistant.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#49372E]">
                        {assistant.department_name || 'Science & Engineering'}
                      </td>
                      <td className="py-3.5 px-4">
                        {assignedLabs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedLabs.map((l) => (
                              <span
                                key={l.id}
                                className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] font-mono text-[10px] text-[#49372E]"
                              >
                                {l.lab_code} • {l.name}
                                {(l.is_public === false || l.lab_type === 'pc_lab') && ' (Internal)'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#B91C1C]">No lab assigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            status === 'active'
                              ? 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                              : status === 'invited'
                              ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                              : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignmentsUser(assistant);
                              setEditingLabIds(assistant.assigned_lab_ids || []);
                            }}
                            className="p-1.5 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#FAF6F0] cursor-pointer"
                            title="Assign Laboratories"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                          </button>

                          {status === 'invited' && (
                            <button
                              type="button"
                              onClick={() => handleResend(assistant)}
                              className="px-2 py-1 rounded-lg bg-[#FAF6F0] border border-[#D8CBB9] text-[11px] font-semibold text-[#49372E] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>Resend</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResetPassword(assistant)}
                            className="p-1.5 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#FAF6F0] cursor-pointer"
                            title="Send Password Setup / Reset Email"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(assistant)}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              status === 'suspended'
                                ? 'border-[#C6E3D0] text-[#2E6F4E] hover:bg-[#EBF5EE]'
                                : 'border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                            }`}
                            title={status === 'suspended' ? 'Activate Account' : 'Suspend Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Lab Assistant Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Add Lab Assistant Account"
        subtitle="Create a verified MVIT Lab Assistant profile and assign laboratory access"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. R. Karthik"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Employee ID *</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. MVIT-LAB-009"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">MVIT Staff Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. karthik.lab@mvit.edu.in"
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">
              Assign Laboratories
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 border border-[#E7DDD0] rounded-lg bg-[#FAF6F0]">
              {labs.map((lab) => {
                const checked = selectedLabIds.includes(lab.id);
                return (
                  <label key={lab.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedLabIds(
                          checked
                            ? selectedLabIds.filter((id) => id !== lab.id)
                            : [...selectedLabIds, lab.id]
                        )
                      }
                    />
                    <span className="font-mono font-bold text-[#49372E]">{lab.lab_code}</span>
                    <span className="text-[#252521]">{lab.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg text-[#49372E]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-[#49372E] hover:bg-[#A66A43] text-white rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Lab Assistant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Labs Modal */}
      <Modal
        isOpen={!!editingAssignmentsUser}
        onClose={() => setEditingAssignmentsUser(null)}
        title={`Assign Laboratories: ${editingAssignmentsUser?.name || ''}`}
        subtitle="Only assigned laboratories are accessible to this Lab Assistant"
      >
        <div className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {labs.map((lab) => {
              const checked = editingLabIds.includes(lab.id);
              return (
                <label
                  key={lab.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#E7DDD0] bg-[#FAF6F0] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setEditingLabIds(
                          checked
                            ? editingLabIds.filter((id) => id !== lab.id)
                            : [...editingLabIds, lab.id]
                        )
                      }
                    />
                    <span className="font-mono font-bold text-[#49372E]">{lab.lab_code}</span>
                    <span className="font-semibold text-[#252521]">{lab.name}</span>
                    {(lab.is_public === false || lab.lab_type === 'pc_lab') && (
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#D8CBB9] font-mono text-[10px] text-[#6E675F]">
                        Internal
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#6E675F]">{lab.status}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setEditingAssignmentsUser(null)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAssignments}
              className="px-4 py-2 text-xs font-bold bg-[#49372E] hover:bg-[#A66A43] text-white rounded-lg cursor-pointer"
            >
              Save Assignments
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
