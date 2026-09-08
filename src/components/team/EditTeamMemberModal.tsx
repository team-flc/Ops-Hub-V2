import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, UserCheck, Building2, Briefcase, Check, 
  AlertCircle, Loader2, Edit3 
} from 'lucide-react';
import { Department, Designation, TeamMemberRecord, UserProfile } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { teamManagementService } from '../../lib/teamManagementService';
import { archiveService } from '../../lib/archiveService';

interface EditTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: TeamMemberRecord | null;
  currentUserProfile: UserProfile | null;
  departments: Department[];
  designations: Designation[];
  eligibleManagers: UserProfile[];
}

export const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  member,
  currentUserProfile,
  departments,
  designations,
  eligibleManagers
}) => {
  const clients = useOpsStore((state) => state.clients);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [checkingTasksForClientId, setCheckingTasksForClientId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setFullName(member.fullName);
      setPhone(member.phone || '');
      setStartDate(member.startDate || new Date().toISOString().split('T')[0]);
      setSelectedDeptIds(member.departments.map((d) => d.id));
      setSelectedDesignationId(member.designationId || '');
      setSelectedManagerId(member.reportingManagerId || '');
      setSelectedClientIds(member.clientIds || []);
      setErrorMessage(null);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleDeptToggle = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleClientToggle = async (clientId: string) => {
    setErrorMessage(null);
    if (selectedClientIds.includes(clientId)) {
      // Trying to revoke client access
      if (member.clientIds && member.clientIds.includes(clientId)) {
        setCheckingTasksForClientId(clientId);
        try {
          const taskCheck = await archiveService.checkTeamMemberClientOpenTasks(member.id, clientId);
          if (taskCheck.hasOpenTasks) {
            const clientName = clients.find(c => c.id === clientId)?.companyName || 'this client';
            setErrorMessage(
              `Cannot revoke Client Access to "${clientName}": ${member.fullName} has ${taskCheck.openTaskCount} open task(s) for this client. Please reassign those open tasks before revoking client access.`
            );
            setCheckingTasksForClientId(null);
            return;
          }
        } catch (err: any) {
          console.warn('Error verifying open tasks:', err);
        } finally {
          setCheckingTasksForClientId(null);
        }
      }
      setSelectedClientIds((prev) => prev.filter((id) => id !== clientId));
    } else {
      setSelectedClientIds((prev) => [...prev, clientId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }

    if (selectedDeptIds.length === 0) {
      setErrorMessage('Please assign at least one department.');
      return;
    }

    if (!selectedDesignationId) {
      setErrorMessage('Please select a designation.');
      return;
    }

    // Safety check for any removed client IDs
    const removedClientIds = (member.clientIds || []).filter((id) => !selectedClientIds.includes(id));
    for (const removedId of removedClientIds) {
      const taskCheck = await archiveService.checkTeamMemberClientOpenTasks(member.id, removedId);
      if (taskCheck.hasOpenTasks) {
        const clientName = clients.find(c => c.id === removedId)?.companyName || 'this client';
        setErrorMessage(
          `Cannot revoke Client Access to "${clientName}": ${member.fullName} has ${taskCheck.openTaskCount} open task(s). Please reassign those tasks before saving.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = await teamManagementService.updateTeamMember(
        {
          id: member.id,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          startDate,
          departmentIds: selectedDeptIds,
          designationId: selectedDesignationId,
          reportingManagerId: selectedManagerId || undefined,
          clientIds: selectedClientIds
        },
        currentUserProfile.id
      );

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                Edit Team Member
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                {member.workEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Personal Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Personal Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Designation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedDesignationId}
                  onChange={(e) => setSelectedDesignationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Designation...</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} {d.status === 'archived' ? '(Archived)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Departments */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-brand-600" />
              <span>Assigned Departments <span className="text-rose-500">*</span></span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {departments.map((dept) => {
                const isSelected = selectedDeptIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleDeptToggle(dept.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-brand-50/70 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-300'
                        : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{dept.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reporting Manager */}
          {currentUserProfile?.role === 'owner' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                <span>Reporting Manager</span>
              </h3>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Manager...</option>
                {eligibleManagers.map((mgr) => (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.fullName} ({mgr.role === 'owner' ? 'Owner' : 'Operational Manager'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client Access */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              <span>Client Access</span>
            </h3>
            {clients.filter((c) => c.status !== 'Archived').length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active clients available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {clients
                  .filter((c) => c.status !== 'Archived')
                  .map((client) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    const isChecking = checkingTasksForClientId === client.id;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleClientToggle(client.id)}
                        disabled={isChecking || isSubmitting}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                          isSelected
                            ? 'bg-brand-50/70 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-300'
                            : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="truncate flex items-center gap-2">
                          <span className="truncate">{client.companyName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-200/60 dark:bg-dark-border text-gray-600 dark:text-gray-300">
                            {client.package}
                          </span>
                        </div>
                        {isChecking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600 flex-shrink-0 ml-1" />
                        ) : isSelected ? (
                          <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 ml-1" />
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
