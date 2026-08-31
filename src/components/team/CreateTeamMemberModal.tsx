import React, { useState, useEffect } from 'react';
import { 
  X, UserPlus, Shield, Building2, Briefcase, UserCheck, 
  Key, Eye, EyeOff, Sparkles, Check, Copy, AlertCircle, 
  Loader2, CheckCircle2 
} from 'lucide-react';
import { Department, Designation, UserProfile } from '../../types';
import { useOpsStore } from '../../store/opsStore';
import { teamManagementService } from '../../lib/teamManagementService';

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
  const clientsVendors = useOpsStore((state) => state.clientsVendors);

  // Form State
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // Default Reporting Manager logic
  useEffect(() => {
    if (currentUserProfile) {
      if (currentUserProfile.role === 'operational_manager') {
        setSelectedManagerId(currentUserProfile.id);
      } else if (currentUserProfile.role === 'owner' && !selectedManagerId) {
        setSelectedManagerId(currentUserProfile.id);
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

  const validatePasswordRequirements = (pwd: string) => {
    const hasMinLen = pwd.length >= 12;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
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
        phone: phone.trim() || undefined,
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
        // Display single-time in-memory credentials screen
        setCreatedCredentials({
          fullName: fullName.trim(),
          workEmail: workEmail.trim().toLowerCase(),
          role: 'Team Member',
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
    const text = `FLC Ops Hub Credentials:\nName: ${createdCredentials.fullName}\nWork Email: ${createdCredentials.workEmail}\nRole: Team Member\nPassword: ${createdCredentials.password}\nPortal URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleModalClose = () => {
    // Wipe memory cleanly
    setCreatedCredentials(null);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setWorkEmail('');
    setPhone('');
    setSelectedDeptIds([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-300 border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-dark-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                {createdCredentials ? 'Account Created Successfully' : 'Create New Team Member'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {createdCredentials 
                  ? 'One-time credential confirmation screen' 
                  : 'Provision account and configure permissions for a new team member'}
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
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {createdCredentials ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-emerald-950">Team Member Provisioned in Supabase Auth</div>
                  <div>Account is active and ready for immediate sign-in.</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">Full Name</span>
                    <span className="font-bold text-slate-800 dark:text-gray-200">{createdCredentials.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">Assigned Role</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                      Team Member
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">Work Email</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-gray-200">{createdCredentials.workEmail}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">Permanent Password</span>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-border font-mono text-sm font-bold text-slate-900 dark:text-gray-100 select-all">
                      <span>{createdCredentials.password}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Important Security Notice:</strong> This permanent password will <em>never</em> be displayed again. Copy and share it securely with the user now.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Login Details'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-dark-100 hover:bg-slate-200 text-slate-700 dark:text-gray-300 text-xs font-bold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* CREATION FORM */
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              {/* 1. PERSONAL INFORMATION */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>1. Personal Information</span>
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
                      placeholder="e.g. Zaid Khan"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      Work Email <span className="text-rose-500">*</span>
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
                      Phone Number (Optional)
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                      System Role
                    </label>
                    <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-xs font-bold text-slate-700 dark:text-gray-300 flex items-center justify-between cursor-not-allowed">
                      <span>Team Member</span>
                      <span className="text-[10px] text-slate-400 font-normal">Fixed</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={onOpenDesignationManager}
                        className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand-600" />
                    <span>3. Assigned Departments <span className="text-rose-500">*</span></span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Multiple allowed (Equal)</span>
                </div>
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
                {clientsVendors.filter((c) => c.type === 'client').length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No active clients available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                    {clientsVendors
                      .filter((c) => c.type === 'client')
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
                            <span className="truncate">{client.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* 6. LOGIN CREDENTIALS */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-brand-600" />
                    <span>6. Login Credentials <span className="text-rose-500">*</span></span>
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
};
