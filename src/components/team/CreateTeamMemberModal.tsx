import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, UserPlus, Shield, Building2, Briefcase, UserCheck, 
  Key, Eye, EyeOff, Sparkles, Check, Copy, AlertCircle, 
  Loader2, CheckCircle2, Camera, Trash2, Clock, DollarSign,
  UserCog, Award
} from 'lucide-react';
import { Department, Designation, UserProfile, WorkShift, EmploymentType, EmploymentStatus } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { teamManagementService } from '../../lib/teamManagementService';
import { employeeOperationsService } from '../../lib/employeeOperationsService';
import { storageService, useSignedUrl } from '../../lib/storageService';
import { getPKTTodayDateString } from '../../lib/pktDateUtils';

interface CreateTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserProfile: UserProfile | null;
  departments: Department[];
  designations: Designation[];
  eligibleManagers: UserProfile[];
  onOpenDesignationManager: () => void;
}

export const CreateTeamMemberModal: React.FC<CreateTeamMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserProfile,
  departments,
  designations,
  eligibleManagers,
  onOpenDesignationManager
}) => {
  const clients = useOpsStore((state) => state.clients);

  // Form State
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const displayAvatarUrl = useSignedUrl('profile-avatars', avatarUrl);
  const [startDate, setStartDate] = useState(getPKTTodayDateString());
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'operational_manager' | 'team_member'>('team_member');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    workEmail: string;
    role: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load Work Shifts
  useEffect(() => {
    async function loadShifts() {
      const fetchedShifts = await employeeOperationsService.fetchWorkShifts();
      setShifts(fetchedShifts);
      if (fetchedShifts.length > 0 && !selectedShiftId) {
        setSelectedShiftId(fetchedShifts[0].id);
      }
    }
    if (isOpen) {
      loadShifts();
      if (!empId) {
        setEmpId(`EMP-${Math.floor(100 + Math.random() * 900)}`);
      }
    }
  }, [isOpen, selectedShiftId, empId]);

  // Default Reporting Manager logic
  useEffect(() => {
    if (currentUserProfile) {
      if (currentUserProfile.role === 'operational_manager') {
        setSelectedManagerId(currentUserProfile.id);
      } else if (currentUserProfile.role === 'owner') {
        setSelectedManagerId((prev) => prev || currentUserProfile.id);
      }
    }
  }, [currentUserProfile]);

  if (!isOpen) return null;

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%^&*()_+~|}{[]:;?><,./-=';
    const all = upper + lower + numbers + special;

    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 16; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    const finalPwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setPassword(finalPwd);
    setConfirmPassword(finalPwd);
  };

  const handleDeptToggle = (deptId: string) => {
    setSelectedDeptIds((prev) => 
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleClientToggle = (clientId: string) => {
    setSelectedClientIds((prev) => 
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

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
      const res = await storageService.uploadAvatar(file, currentUserProfile?.id || 'pending');
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

  const validatePasswordRequirements = (pwd: string) => {
    const hasMinLen = pwd.length >= 12;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
    return { hasMinLen, hasUpper, hasLower, hasNumber, hasSpecial, isValid: hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial };
  };

  const pwdValidation = validatePasswordRequirements(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }

    if (!workEmail.trim() || !workEmail.includes('@')) {
      setErrorMessage('A valid work email address is required.');
      return;
    }

    if (linkedinUrl.trim() && !/^https?:\/\//i.test(linkedinUrl.trim())) {
      setErrorMessage('Invalid LinkedIn URL. Must start with http:// or https://');
      return;
    }

    if (facebookUrl.trim() && !/^https?:\/\//i.test(facebookUrl.trim())) {
      setErrorMessage('Invalid Facebook URL. Must start with http:// or https://');
      return;
    }

    if (instagramUrl.trim() && !/^https?:\/\//i.test(instagramUrl.trim())) {
      setErrorMessage('Invalid Instagram URL. Must start with http:// or https://');
      return;
    }

    if (contactEmail.trim() && !contactEmail.includes('@')) {
      setErrorMessage('A valid Connected Contact Gmail/Email address is required.');
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

    if (!selectedManagerId) {
      setErrorMessage('Please select a reporting manager.');
      return;
    }

    if (!pwdValidation.isValid) {
      setErrorMessage('Password must be at least 12 characters and contain uppercase, lowercase, numbers, and special symbols.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await teamManagementService.createTeamMember({
        fullName: fullName.trim(),
        workEmail: workEmail.trim().toLowerCase(),
        role: selectedRole,
        phone: phone.trim() || undefined,
        backupPhone: backupPhone.trim() || undefined,
        contactEmail: contactEmail.trim().toLowerCase() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        facebookUrl: facebookUrl.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl || null,
        startDate,
        departmentIds: selectedDeptIds,
        designationId: selectedDesignationId,
        reportingManagerId: selectedManagerId,
        clientIds: selectedClientIds,
        password
      });

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else {
        // Upsert companion employee record
        if (result.user?.id && currentUserProfile?.id) {
          await employeeOperationsService.upsertEmployeeRecord({
            id: result.user.id,
            employeeId: empId.trim() || undefined,
            employmentType,
            dateOfBirth: dob || undefined,
            salary: salary ? Number(salary) : 0,
            jobDescription: jobDescription.trim() || undefined,
            shiftId: selectedShiftId || undefined,
            customCheckInTime: customCheckInTime.trim() || undefined,
            customCheckOutTime: customCheckOutTime.trim() || undefined,
            employmentStatus,
            setupCompletedAt: setupCompleted ? new Date().toISOString() : null
          }, currentUserProfile.id);
        }

        // Display single-time in-memory credentials screen
        setCreatedCredentials({
          fullName: fullName.trim(),
          workEmail: workEmail.trim().toLowerCase(),
          role: selectedRole === 'operational_manager' ? 'Operational Manager' : 'Team Member',
          password
        });
        setIsSubmitting(false);
        onSuccess();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while creating the team member.');
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `FLC Ops Hub Credentials:\nName: ${createdCredentials.fullName}\nWork Email: ${createdCredentials.workEmail}\nRole: ${createdCredentials.role}\nPassword: ${createdCredentials.password}\nPortal URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleModalClose = () => {
    setFullName('');
    setWorkEmail('');
    setPhone('');
    setBackupPhone('');
    setContactEmail('');
    setLinkedinUrl('');
    setBio('');
    setAvatarUrl(null);
    setStartDate(getPKTTodayDateString());
    setSelectedDeptIds([]);
    setSelectedDesignationId('');
    setSelectedClientIds([]);
    setPassword('');
    setConfirmPassword('');
    setSetupCompleted(false);
    setErrorMessage(null);
    setCreatedCredentials(null);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/60 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
                {createdCredentials ? 'Team Member Created' : 'Create New Team Member'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {createdCredentials ? 'Copy login credentials securely' : 'Provision internal staff with role, departments & compensation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {createdCredentials ? (
            /* Single-Time Credentials Screen */
            <div className="space-y-6 py-2">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Account Provisioned Successfully!
                  </h4>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    The credentials below are displayed once in memory. Copy and securely share them with the team member.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{createdCredentials.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{createdCredentials.workEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{createdCredentials.role}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-dark-border">
                  <span className="text-slate-400">Password:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded-md">
                    {createdCredentials.password}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-brand-500/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 text-xs font-semibold hover:bg-slate-100"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. PERSONAL INFORMATION */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>1. Personal & Contact Information</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Profile Avatar Upload */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Profile Avatar (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      {displayAvatarUrl ? (
                        <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-dark-border">
                          <img src={displayAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
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
                          id="avatar-upload"
                          onChange={handleAvatarUpload}
                          disabled={isUploadingAvatar}
                          className="hidden"
                        />
                        <label
                          htmlFor="avatar-upload"
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 cursor-pointer inline-block"
                        >
                          {isUploadingAvatar ? 'Uploading...' : 'Choose Image'}
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
                      placeholder="e.g. Zaid Khan"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Official Work Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="name@faseehlall.com"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Primary Phone (Pakistan / International)
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

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Facebook Profile URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      placeholder="https://facebook.com/username"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Instagram Profile URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="https://instagram.com/username"
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
                </div>
              </div>

              {/* 2. ROLE & DESIGNATION */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-brand-600" />
                  <span>2. Role & Designation</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="create-member-role-select" className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                        System Role
                      </label>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {currentUserProfile?.role === 'owner' ? (selectedRole === 'team_member' ? 'Fixed' : 'Configured') : 'Fixed'}
                      </span>
                    </div>
                    {currentUserProfile?.role === 'owner' ? (
                      <select
                        id="create-member-role-select"
                        aria-label="System Role"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                      >
                        <option value="team_member">Team Member</option>
                        <option value="operational_manager">Operational Manager</option>
                      </select>
                    ) : (
                      <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-xs font-bold text-slate-700 dark:text-gray-300 flex items-center justify-between cursor-not-allowed">
                        <span>Team Member</span>
                        <span className="text-[10px] text-slate-400 font-normal">Fixed</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={onOpenDesignationManager}
                        className="text-[11px] font-semibold text-brand-600 hover:underline"
                      >
                        + Add Designation
                      </button>
                    </div>
                    <select
                      value={selectedDesignationId}
                      onChange={(e) => setSelectedDesignationId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select Designation...</option>
                      {designations.filter((d) => d.status === 'active').map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. DEPARTMENTS */}
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

              {/* 4. REPORTING MANAGER */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>4. Reporting Manager <span className="text-rose-500">*</span></span>
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
                    {eligibleManagers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.fullName} ({mgr.role === 'owner' ? 'Owner' : 'Operational Manager'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 5. CLIENT ACCESS */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                    <span>5. Client Access (Optional)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Default: 0 clients</span>
                </div>
                {clients.filter((c) => c.status !== 'Archived').length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No available clients.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                    {clients
                      .filter((c) => c.status !== 'Archived')
                      .map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleClientToggle(client.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                              isSelected
                                ? 'bg-brand-50/70 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-300'
                                : 'bg-slate-50 dark:bg-dark-sidebar border-slate-200 dark:border-dark-border text-slate-700 dark:text-gray-300 hover:bg-slate-100'
                            }`}
                          >
                            <div className="min-w-0 pr-1 truncate">
                              <span className="truncate block font-bold">{client.companyName}</span>
                              {client.status === 'Paused' && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold block">(Paused)</span>
                              )}
                              {client.status === 'Onboarding' && (
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold block">(Onboarding)</span>
                              )}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* 6. EMPLOYEE OPERATIONS & COMPENSATION (PARITY SECTION) */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <UserCog className="w-3.5 h-3.5 text-brand-600" />
                  <span>6. Employee Operations & Compensation Details</span>
                </h3>

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
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Custom Check-In Time (Override)
                    </label>
                    <input
                      type="time"
                      value={customCheckInTime}
                      onChange={(e) => setCustomCheckInTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Custom Check-Out Time (Override)
                    </label>
                    <input
                      type="time"
                      value={customCheckOutTime}
                      onChange={(e) => setCustomCheckOutTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Job Description & Operational Scope
                  </label>
                  <textarea
                    rows={2}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Key deliverables, client responsibilities, and operational duties..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                {/* Setup Completed Toggle */}
                <div className="p-3 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-gray-200 block">
                      Employee Operations Setup Completed
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400">
                      Enables shift scheduling, live attendance presence tracking, and payroll cycle inclusion
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={setupCompleted}
                    onChange={(e) => setSetupCompleted(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded-md focus:ring-brand-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 7. LOGIN CREDENTIALS */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-brand-600" />
                    <span>7. Login Credentials <span className="text-rose-500">*</span></span>
                  </h3>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Permanent Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pr-9 pl-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Password strength indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] pt-1">
                  <div className={`flex items-center gap-1 ${pwdValidation.hasMinLen ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> 12+ Characters
                  </div>
                  <div className={`flex items-center gap-1 ${pwdValidation.hasUpper && pwdValidation.hasLower ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Mixed Case
                  </div>
                  <div className={`flex items-center gap-1 ${pwdValidation.hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Number
                  </div>
                  <div className={`flex items-center gap-1 ${pwdValidation.hasSpecial ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Special Character
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-600 dark:text-gray-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-dark-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Team Member</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
