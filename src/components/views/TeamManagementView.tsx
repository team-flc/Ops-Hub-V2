import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, UserPlus, Search, ShieldCheck, 
  Building2, Briefcase, UserCheck, Key, UserX, 
  RotateCcw, MoreVertical, Loader2, Edit3 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  Department, 
  Designation, 
  TeamMemberRecord, 
  UserProfile 
} from '../../types';
import { teamManagementService } from '../../lib/teamManagementService';

import { CreateTeamMemberModal } from '../team/CreateTeamMemberModal';
import { EditTeamMemberModal } from '../team/EditTeamMemberModal';
import { ResetPasswordModal } from '../team/ResetPasswordModal';
import { DesignationManagerModal } from '../team/DesignationManagerModal';
import { SuspendUserModal } from '../team/SuspendUserModal';

export const TeamManagementView: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();

  // State
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [eligibleManagers, setEligibleManagers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState('');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberRecord | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<TeamMemberRecord | null>(null);
  const [suspendingMember, setSuspendingMember] = useState<TeamMemberRecord | null>(null);
  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);

  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUserProfile) return;
    setIsLoading(true);

    try {
      const [members, depts, desigs, managers] = await Promise.all([
        teamManagementService.fetchTeamMembers(currentUserProfile.role, currentUserProfile.id),
        teamManagementService.fetchDepartments(),
        teamManagementService.fetchDesignations(),
        teamManagementService.fetchEligibleManagers()
      ]);

      setTeamMembers(members);
      setDepartments(depts);
      setDesignations(desigs);
      setEligibleManagers(managers);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setIsLoading(false);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered List
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.fullName.toLowerCase().includes(q);
        const matchesEmail = m.workEmail.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      // Department
      if (selectedDeptFilter && !m.departments.some((d) => d.id === selectedDeptFilter)) {
        return false;
      }
      // Designation
      if (selectedDesignationFilter && m.designationId !== selectedDesignationFilter) {
        return false;
      }
      // Manager
      if (selectedManagerFilter && m.reportingManagerId !== selectedManagerFilter) {
        return false;
      }
      // Status
      if (selectedStatusFilter && m.status !== selectedStatusFilter) {
        return false;
      }
      return true;
    });
  }, [teamMembers, searchQuery, selectedDeptFilter, selectedDesignationFilter, selectedManagerFilter, selectedStatusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = teamMembers.length;
    const active = teamMembers.filter((m) => m.status === 'active').length;
    const suspended = teamMembers.filter((m) => m.status === 'suspended').length;
    const activeDepts = new Set(teamMembers.flatMap((m) => m.departments.map((d) => d.id))).size;
    return { total, active, suspended, activeDepts };
  }, [teamMembers]);

  const handleReactivate = async (memberId: string) => {
    if (!confirm('Are you sure you want to reactivate this team member account?')) return;
    try {
      await teamManagementService.reactivateTeamMember(memberId);
      loadData();
    } catch (err) {
      console.error('Failed to reactivate:', err);
    }
  };

  const isManagerOrOwner = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-gray-100 tracking-tight">
              Team Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Governance, reporting structures, department assignments, and client access controls
          </p>
        </div>

        {isManagerOrOwner && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDesignationModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-200 hover:bg-slate-50 dark:hover:bg-dark-100 text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              <span>Designations</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Team</span>
          <div className="text-2xl font-black text-slate-900 dark:text-gray-100">{metrics.total}</div>
        </div>

        <div className="p-4 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active</span>
          <div className="text-2xl font-black text-emerald-600">{metrics.active}</div>
        </div>

        <div className="p-4 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Suspended</span>
          <div className="text-2xl font-black text-rose-600">{metrics.suspended}</div>
        </div>

        <div className="p-4 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Depts</span>
          <div className="text-2xl font-black text-slate-900 dark:text-gray-100">{metrics.activeDepts}</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Designation Filter */}
          <select
            value={selectedDesignationFilter}
            onChange={(e) => setSelectedDesignationFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Designations</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Manager Filter */}
          {currentUserProfile?.role === 'owner' && (
            <select
              value={selectedManagerFilter}
              onChange={(e) => setSelectedManagerFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Managers</option>
              {eligibleManagers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-dark-sidebar border border-slate-200 dark:border-dark-border rounded-xl text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Team Table */}
      <div className="bg-white dark:bg-dark-200 border border-slate-200 dark:border-dark-border rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
            <p className="text-xs">Loading verified team directory...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-gray-300">No Team Members Found</div>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Try adjusting your filters.' : 'Click "Create New User" to provision your first team member.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
              <thead className="bg-slate-50/75 dark:bg-dark-sidebar border-b border-slate-100 dark:border-dark-border text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Team Member</th>
                  <th className="px-4 py-3.5">Designation</th>
                  <th className="px-4 py-3.5">Departments</th>
                  <th className="px-4 py-3.5">Reporting Manager</th>
                  <th className="px-4 py-3.5">Clients</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {filteredMembers.map((member) => {
                  const initials = member.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-dark-100/60 transition-colors">
                      {/* Name & Work Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 text-brand-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-gray-100">{member.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{member.workEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="px-4 py-4">
                        <span className="font-medium text-slate-800 dark:text-gray-200">
                          {member.designationName}
                        </span>
                      </td>

                      {/* Departments (Equal badges) */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {member.departments.map((dept) => (
                            <span
                              key={dept.id}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-dark-sidebar dark:text-gray-300 border border-slate-200/80"
                            >
                              {dept.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Reporting Manager */}
                      <td className="px-4 py-4 text-slate-600 dark:text-gray-300">
                        {member.reportingManagerName}
                      </td>

                      {/* Client Access */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          member.clientAccessCount > 0 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {member.clientAccessCount} {member.clientAccessCount === 1 ? 'client' : 'clients'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          member.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {member.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="px-4 py-4 text-slate-500 font-mono text-[11px]">
                        {member.startDate}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right relative">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-dark-100 transition-colors"
                            title="Edit Team Member"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setResetPasswordMember(member)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-dark-100 transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {member.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => setSuspendingMember(member)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-dark-100 transition-colors"
                              title="Suspend / Offboard"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(member.id)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-dark-100 transition-colors"
                              title="Reactivate Account"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Team Member Modal */}
      <CreateTeamMemberModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
        currentUserProfile={currentUserProfile}
        departments={departments}
        designations={designations}
        eligibleManagers={eligibleManagers}
        onOpenDesignationManager={() => setIsDesignationModalOpen(true)}
      />

      {/* Edit Team Member Modal */}
      <EditTeamMemberModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        onSuccess={loadData}
        member={editingMember}
        currentUserProfile={currentUserProfile}
        departments={departments}
        designations={designations}
        eligibleManagers={eligibleManagers}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={!!resetPasswordMember}
        onClose={() => setResetPasswordMember(null)}
        member={resetPasswordMember}
      />

      {/* Suspend Offboarding Modal */}
      <SuspendUserModal
        isOpen={!!suspendingMember}
        onClose={() => setSuspendingMember(null)}
        onSuccess={loadData}
        member={suspendingMember}
        activeTeamMembers={teamMembers}
        currentUserProfile={currentUserProfile}
      />

      {/* Designation Manager Modal */}
      <DesignationManagerModal
        isOpen={isDesignationModalOpen}
        onClose={() => setIsDesignationModalOpen(false)}
        designations={designations}
        onRefresh={loadData}
        currentUserProfile={currentUserProfile}
      />
    </div>
  );
};
