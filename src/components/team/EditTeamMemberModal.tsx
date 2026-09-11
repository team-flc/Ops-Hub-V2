import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, UserCheck, Building2, Briefcase, Check, 
  AlertCircle, Loader2, Edit3, Clock, DollarSign,
  UserCog, ShieldCheck, Lock, Camera, Trash2, Shield
} from 'lucide-react';
import { Department, Designation, TeamMemberRecord, UserProfile, WorkShift, EmployeeRecord, EmploymentType, EmploymentStatus } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { teamManagementService } from '../../lib/teamManagementService';
import { archiveService } from '../../lib/archiveService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { storageService, useSignedUrl } from '../../lib/storageService';
import { supabase } from '../../lib/supabase';

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

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const displayAvatarUrl = useSignedUrl('profile-avatars', avatarUrl);
  const [startDate, setStartDate] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [checkingTasksForClientId, setCheckingTasksForClientId] = useState<string | null>(null);

  // Companion Employee Record Fields
  const [empId, setEmpId] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [dob, setDob] = useState('');
  const [salary, setSalary] = useState<number | ''>('');
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [customCheckInTime, setCustomCheckInTime] = useState('');
  const [customCheckOutTime, setCustomCheckOutTime] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('active');
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [existingSetupCompletedAt, setExistingSetupCompletedAt] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanionData() {
      if (!member) return;
      setFullName(member.fullName);
      setPhone(member.phone || '');
      setStartDate(member.startDate || new Date().toISOString().split('T')[0]);
      setSelectedDeptIds(member.departments.map((d) => d.id));
      setSelectedDesignationId(member.designationId || '');
      setSelectedManagerId(member.reportingManagerId || '');
      setSelectedClientIds(member.clientIds || []);
      setErrorMessage(null);

      try {
        if (supabase) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', member.id)
            .maybeSingle();

          if (prof) {
            setAvatarUrl(prof.avatar_url || null);
            setBackupPhone(prof.backup_phone || '');
            setContactEmail(prof.contact_email || '');
            setLinkedinUrl(prof.linkedin_url || '');
            setBio(prof.bio || '');
          }
        }

        const [fetchedShifts, employeeRec] = await Promise.all([
          employeeOperationsService.fetchWorkShifts(),
          employeeOperationsService.fetchEmployeeRecord(member.id)
        ]);

        setShifts(fetchedShifts);
        if (employeeRec) {
          setEmpId(employeeRec.employeeId || '');
          setEmploymentType(employeeRec.employmentType || 'full_time');
          setDob(employeeRec.dateOfBirth || '');
          setSalary(employeeRec.salary || '');
          setSelectedShiftId(employeeRec.shiftId || (fetchedShifts[0]?.id || ''));
          setCustomCheckInTime(employeeRec.customCheckInTime || '');
          setCustomCheckOutTime(employeeRec.customCheckOutTime || '');
          setJobDescription(employeeRec.jobDescription || '');
          setEmploymentStatus(employeeRec.employmentStatus || 'active');
          setSetupCompleted(Boolean(employeeRec.setupCompletedAt));
          setExistingSetupCompletedAt(employeeRec.setupCompletedAt || null);
        } else if (fetchedShifts.length > 0) {
          setSelectedShiftId(fetchedShifts[0].id);
          setSetupCompleted(false);
        }
      } catch (err) {
        console.error('Failed to load companion employee data:', err);
      }
    }

    if (isOpen && member) {
      loadCompanionData();
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = storageService.validateImage(file);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid avatar image.');
      return;
    }
    setIsUploadingAvatar(true);
    setErrorMessage(null);
    try {
      const res = await storageService.uploadAvatar(file, member.id);
      if (res.error || !res.path) {
        setErrorMessage(res.error || 'Failed to upload avatar image.');
      } else {
        setAvatarUrl(res.path);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload avatar image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleDeptToggle = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleClientToggle = async (clientId: string) => {
    setErrorMessage(null);
    if (selectedClientIds.includes(clientId)) {
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

    if (linkedinUrl.trim() && !/^https?:\/\//i.test(linkedinUrl.trim())) {
      setErrorMessage('Invalid LinkedIn URL. Must start with http:// or https://');
      return;
    }

    if (contactEmail.trim() && !contactEmail.includes('@')) {
      setErrorMessage('A valid Connected Contact Email address is required.');
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
          backupPhone: backupPhone.trim() || undefined,
          contactEmail: contactEmail.trim().toLowerCase() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl || null,
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

      let resolvedSetupCompletedAt: string | null = null;
      if (setupCompleted) {
        resolvedSetupCompletedAt = existingSetupCompletedAt || new Date().toISOString();
      }

      // Sync companion employee record
      await employeeOperationsService.upsertEmployeeRecord({
        id: member.id,
        employeeId: empId.trim() || undefined,
        employmentType,
        dateOfBirth: dob || undefined,
        salary: salary ? Number(salary) : 0,
        jobDescription: jobDescription.trim() || undefined,
        shiftId: selectedShiftId || undefined,
        customCheckInTime: customCheckInTime.trim() || undefined,
        customCheckOutTime: customCheckOutTime.trim() || undefined,
        employmentStatus,
        setupCompletedAt: resolvedSetupCompletedAt
      }, currentUserProfile.id);

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-gray-100">
                Edit Team Member Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-mono flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>{member.workEmail}</span>
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
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* 1. Personal Info & Contact */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>1. Personal & Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Profile Avatar */}
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Profile Avatar
                </label>
                <div className="flex items-center gap-3">
                  {displayAvatarUrl ? (
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-dark-border">
                      <img src={displayAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        title="Remove avatar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border flex items-center justify-center text-slate-400">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      id="edit-avatar-upload"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                    <label
                      htmlFor="edit-avatar-upload"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 cursor-pointer inline-block"
                    >
                      {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
                    </label>
                    <span className="text-[10px] text-slate-400 block mt-0.5">JPEG, PNG, WebP up to 2MB</span>
                  </div>
                </div>
              </div>

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
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1">
                  <span>Official Work Email</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <div className="w-full px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl text-slate-500 dark:text-gray-400 font-mono flex items-center justify-between cursor-not-allowed">
                  <span>{member.workEmail}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Immutable</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Primary Phone
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
                  Backup / WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={backupPhone}
                  onChange={(e) => setBackupPhone(e.target.value)}
                  placeholder="+92 321 7654321"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Personal Gmail / Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact.gmail@gmail.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  LinkedIn Profile URL (Optional)
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="col-span-1 sm:col-span-2 space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Professional Bio (Optional)
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief summary of member's professional background and skills..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Start Date <span className="text-rose-500">*</span>
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
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. EMPLOYEE OPERATIONS & COMPENSATION (PARITY SECTION) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <UserCog className="w-3.5 h-3.5 text-brand-600" />
              <span>2. Employee Operations & Compensation</span>
            </h3>

            {/* Setup Completed Toggle Banner */}
            <div className="p-3.5 rounded-2xl bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/50 flex items-start gap-3">
              <input
                type="checkbox"
                id="setup-completed-toggle"
                checked={setupCompleted}
                onChange={(e) => setSetupCompleted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <div className="flex-1 text-xs">
                <label htmlFor="setup-completed-toggle" className="font-bold text-slate-900 dark:text-gray-100 cursor-pointer block">
                  Employee Operations Setup Completed
                </label>
                <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-0.5">
                  When checked, this team member is unlocked for automated monthly payroll generation, shift scheduling, and attendance audit tracking.
                </p>
                {existingSetupCompletedAt && (
                  <span className="inline-block mt-1 text-[10px] text-brand-700 dark:text-brand-300 font-mono">
                    Completed at: {new Date(existingSetupCompletedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Employee ID (Badge / Code)
                </label>
                <input
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="e.g. EMP-101"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Employment Type
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="probation">Probationary</option>
                  <option value="intern">Internship</option>
                  <option value="contract">Contractual</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Base Monthly Salary (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 150000"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Assigned Work Shift
                </label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)} PKT)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Custom Shift Check-In Time (Optional override)
                </label>
                <input
                  type="time"
                  value={customCheckInTime}
                  onChange={(e) => setCustomCheckInTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Custom Shift Check-Out Time (Optional override)
                </label>
                <input
                  type="time"
                  value={customCheckOutTime}
                  onChange={(e) => setCustomCheckOutTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Employment Status
                </label>
                <select
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                  <option value="resigned">Resigned</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Job Description & Scope
              </label>
              <textarea
                rows={2}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Key deliverables, client responsibilities, and operational duties..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>

          {/* 3. Departments */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-brand-600" />
              <span>3. Assigned Departments <span className="text-rose-500">*</span></span>
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

          {/* 4. Reporting Manager */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>4. Reporting Manager</span>
            </h3>
            {currentUserProfile?.role === 'operational_manager' ? (
              <div className="p-3 bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-xs">
                <span className="text-slate-500">Assigned Manager: </span>
                <strong className="text-slate-900 dark:text-gray-100">{currentUserProfile.fullName} (You)</strong>
              </div>
            ) : (
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Active Manager...</option>
                {eligibleManagers
                  .filter((m) => m.id !== member.id)
                  .map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.fullName} ({mgr.role === 'owner' ? 'Owner' : 'Operational Manager'})
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* 5. Client Access */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              <span>5. Client Access</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
              {clients
                .filter((c) => c.status !== 'Archived')
                .map((client) => {
                  const isSelected = selectedClientIds.includes(client.id);
                  const isChecking = checkingTasksForClientId === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      disabled={isChecking}
                      onClick={() => handleClientToggle(client.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                        isSelected
                          ? 'bg-brand-50/70 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-300'
                          : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{client.companyName}</span>
                      {isChecking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : isSelected ? (
                        <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 ml-1" />
                      ) : null}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50"
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
