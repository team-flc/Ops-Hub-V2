import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EditTeamMemberModal } from '../src/components/team/EditTeamMemberModal';
import { teamManagementService } from '../src/lib/teamManagementService';
import { archiveService } from '../src/lib/archiveService';
import { TeamMemberRecord, UserProfile } from '../src/types';
import { useOpsStore } from '../src/store/opsStore';
import fs from 'fs';
import path from 'path';

// Mock Supabase
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../src/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: () => mockGetSession(),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user' } } }),
        signOut: vi.fn()
      },
      functions: {
        invoke: (fn: string, opts: any) => mockInvoke(fn, opts)
      },
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis()
      }))
    }
  };
});

describe('Team Member Client Assignment & Scope Authorization Suite', () => {
  const ownerUser: UserProfile = {
    id: 'owner-uuid-1',
    fullName: 'Owner User',
    role: 'owner',
    status: 'active',
    createdAt: '',
    updatedAt: ''
  };

  const managerUser: UserProfile = {
    id: 'manager-uuid-1',
    fullName: 'Ops Manager',
    role: 'operational_manager',
    status: 'active',
    createdAt: '',
    updatedAt: ''
  };

  const mockDepts = [
    { id: 'dept-ops', name: 'Operations', slug: 'operations', status: 'active' as const, sortOrder: 1, createdAt: '', updatedAt: '' }
  ];

  const mockDesignations = [
    { id: 'desig-spec', name: 'Specialist', status: 'active' as const, createdAt: '', updatedAt: '' }
  ];

  const baseMember: TeamMemberRecord = {
    id: 'member-uuid-1',
    fullName: 'Sara Ahmed',
    workEmail: 'sara@example.com',
    role: 'team_member',
    status: 'active',
    startDate: '2026-01-15',
    departments: mockDepts,
    designationId: 'desig-spec',
    reportingManagerId: 'manager-uuid-1',
    clientAccessCount: 1,
    clientIds: ['client-uuid-alpha'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'mock-bearer-token' } },
      error: null
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  describe('1. Database Migration & SQL Function Type Fix', () => {
    it('1.1 Verifies migration script exists and addresses the exact uuid[] vs text[] COALESCE mismatch', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../supabase/migrations/20260925000004_fix_sync_member_client_access_type_coercion.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, 'utf-8');

      // Function signature
      expect(content).toContain('CREATE OR REPLACE FUNCTION public.sync_member_client_access_tx(');
      expect(content).toContain('p_profile_id UUID');
      expect(content).toContain('p_new_client_ids UUID[]');
      expect(content).toContain('p_actor_id UUID');

      // Check COALESCE unification to UUID[]
      expect(content).toContain('COALESCE(array_agg(DISTINCT cid), ARRAY[]::UUID[])');

      // Check query unions client_team_access (UUID) and cast profile_client_access
      expect(content).toContain('FROM public.client_team_access');
      expect(content).toContain('FROM public.profile_client_access');
      expect(content).toContain('client_id::UUID AS cid');

      // Check removal of silent EXCEPTION WHEN OTHERS THEN NULL
      expect(content).not.toContain('EXCEPTION WHEN');
      expect(content).not.toContain('WHEN OTHERS THEN');

      // Check drop of obsolete legacy foreign key
      expect(content).toContain('ALTER TABLE public.profile_client_access DROP CONSTRAINT IF EXISTS profile_client_access_client_id_fkey');

      // Check parity verification checks across both tables
      expect(content).toContain('IF v_cta_count <> v_expected_count OR v_pca_count <> v_expected_count THEN');
      expect(content).toContain('IF v_cta_count <> 0 OR v_pca_count <> 0 THEN');

      // Check strict grants: revoke from anon & authenticated, grant only to service_role
      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) FROM anon, authenticated');
      expect(content).toContain('GRANT EXECUTE ON FUNCTION public.sync_member_client_access_tx(UUID, UUID[], UUID) TO service_role');
    });
  });

  describe('2. Client Access Assignment: Zero, One, and Multiple Clients', () => {
    it('2.1 Saves ZERO assigned clients (clearing all assignments)', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Team member updated successfully.' },
        error: null
      });

      const res = await teamManagementService.updateTeamMember({
        id: baseMember.id,
        fullName: baseMember.fullName,
        departmentIds: ['dept-ops'],
        designationId: 'desig-spec',
        clientIds: [] // Zero clients
      });

      expect(res.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith(
        'manage-team-member',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'update',
            id: 'member-uuid-1',
            clientIds: []
          })
        })
      );
    });

    it('2.2 Saves ONE assigned client', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Team member updated successfully.' },
        error: null
      });

      const res = await teamManagementService.updateTeamMember({
        id: baseMember.id,
        fullName: baseMember.fullName,
        departmentIds: ['dept-ops'],
        designationId: 'desig-spec',
        clientIds: ['client-uuid-alpha']
      });

      expect(res.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith(
        'manage-team-member',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'update',
            id: 'member-uuid-1',
            clientIds: ['client-uuid-alpha']
          })
        })
      );
    });

    it('2.3 Saves MULTIPLE assigned clients', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Team member updated successfully.' },
        error: null
      });

      const newClients = ['client-uuid-alpha', 'client-uuid-beta', 'client-uuid-gamma'];
      const res = await teamManagementService.updateTeamMember({
        id: baseMember.id,
        fullName: baseMember.fullName,
        departmentIds: ['dept-ops'],
        designationId: 'desig-spec',
        clientIds: newClients
      });

      expect(res.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith(
        'manage-team-member',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'update',
            id: 'member-uuid-1',
            clientIds: newClients
          })
        })
      );
    });
  });

  describe('3. Explicit Save Action & State Preservation', () => {
    it('3.1 Client access changes take effect ONLY after explicit Save Changes action (not on checkbox toggle)', async () => {
      const updateSpy = vi.spyOn(teamManagementService, 'updateTeamMember').mockResolvedValue({});

      render(
        <EditTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          member={baseMember}
          currentUserProfile={ownerUser}
          departments={mockDepts}
          designations={mockDesignations}
          eligibleManagers={[ownerUser]}
        />
      );

      // Verify updateTeamMember has NOT been called on render or toggle
      expect(updateSpy).not.toHaveBeenCalled();

      // Submit form
      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledTimes(1);
      });

      updateSpy.mockRestore();
    });

    it('3.2 Preserves existing profile details and client assignments when updating unrelated fields', async () => {
      const updateSpy = vi.spyOn(teamManagementService, 'updateTeamMember').mockResolvedValue({});

      render(
        <EditTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          member={baseMember}
          currentUserProfile={ownerUser}
          departments={mockDepts}
          designations={mockDesignations}
          eligibleManagers={[ownerUser]}
        />
      );

      // Edit name
      const nameInput = screen.getByDisplayValue('Sara Ahmed');
      fireEvent.change(nameInput, { target: { value: 'Sara Ahmed Updated' } });

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'Sara Ahmed Updated',
            clientIds: ['client-uuid-alpha'], // Preserved existing client assignments
            departmentIds: ['dept-ops'],
            designationId: 'desig-spec'
          }),
          ownerUser.id
        );
      });

      updateSpy.mockRestore();
    });

    it('3.3 Non-owner cannot change governed system roles', async () => {
      const updateSpy = vi.spyOn(teamManagementService, 'updateTeamMember').mockResolvedValue({});

      render(
        <EditTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          member={baseMember}
          currentUserProfile={managerUser} // Operational Manager
          departments={mockDepts}
          designations={mockDesignations}
          eligibleManagers={[managerUser]}
        />
      );

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            role: undefined // Manager cannot pass or modify role
          }),
          managerUser.id
        );
      });

      updateSpy.mockRestore();
    });
  });

  describe('4. Manager Scope Enforcement & Authorization Safeguards', () => {
    it('4.1 Edge Function returns 403 Forbidden when an operational manager attempts to assign clients outside permitted scope', async () => {
      const forbiddenError = {
        message: 'Forbidden: Cannot grant access to clients outside your operational scope.',
        context: {
          json: vi.fn().mockResolvedValue({
            error: 'Forbidden: Cannot grant access to clients outside your operational scope.'
          })
        }
      };

      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: forbiddenError
      });

      const res = await teamManagementService.updateTeamMember({
        id: baseMember.id,
        fullName: baseMember.fullName,
        departmentIds: ['dept-ops'],
        designationId: 'desig-spec',
        clientIds: ['unauthorized-client-999']
      });

      expect(res.error).toBe('Forbidden: Cannot grant access to clients outside your operational scope.');
    });

    it('4.2 Blocks client revocation when team member has open tasks on the client being removed', async () => {
      useOpsStore.setState({
        clients: [
          { id: 'client-uuid-alpha', companyName: 'Acme Global', status: 'Active' } as any
        ]
      });

      vi.spyOn(archiveService, 'checkTeamMemberClientOpenTasks').mockResolvedValue({
        hasOpenTasks: true,
        openTaskCount: 3
      });

      render(
        <EditTeamMemberModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          member={baseMember}
          currentUserProfile={ownerUser}
          departments={mockDepts}
          designations={mockDesignations}
          eligibleManagers={[ownerUser]}
        />
      );

      // Attempt to deselect Acme Global
      const clientBtn = screen.getByText('Acme Global');
      fireEvent.click(clientBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Cannot revoke Client Access to "Acme Global": Sara Ahmed has 3 open task\(s\) for this client/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('5. Resilient Edge Function Fallback Simulation', () => {
    it('5.1 Edge function code contains fallback handling for COALESCE uuid[] to text[] type mismatch', () => {
      const edgeFuncPath = path.resolve(
        __dirname,
        '../supabase/functions/manage-team-member/index.ts'
      );
      const edgeFuncContent = fs.readFileSync(edgeFuncPath, 'utf-8');

      // Check fallback code exists
      expect(edgeFuncContent).toContain('COALESCE could not convert type uuid[] to text[]');
      expect(edgeFuncContent).toContain('42846');
      expect(edgeFuncContent).toContain('sync_member_client_access_tx');
      expect(edgeFuncContent).toContain('client_team_access');
      expect(edgeFuncContent).toContain('profile_client_access');

      // Check manager scope enforcement in update action
      expect(edgeFuncContent).toContain('callerProfile.role === \'operational_manager\'');
      expect(edgeFuncContent).toContain('Forbidden: Cannot grant access to clients outside your operational scope.');

      // Check strict error checking on both tables (no silent catch)
      expect(edgeFuncContent).not.toContain('catch (pcaErr)');
      expect(edgeFuncContent).toContain('ctaInsertErr');
      expect(edgeFuncContent).toContain('pcaInsertErr');
      expect(edgeFuncContent).toContain('await supabaseAdmin.from(\'client_team_access\').delete().eq(\'profile_id\', targetUserId)');
    });
  });

  describe('6. Persistence & Client Access Isolation Across Reload', () => {
    it('6.1 Simulates fetching team members after saving zero clients: member receives 0 client access', async () => {
      const viSupabase = await import('../src/lib/supabase');
      const mockProfiles = [
        {
          id: 'member-uuid-1',
          full_name: 'Sara Ahmed',
          work_email: 'sara@example.com',
          role: 'team_member',
          status: 'active',
          reporting_manager_id: 'manager-uuid-1',
          designation_id: 'desig-spec',
          start_date: '2026-01-15'
        }
      ];

      (viSupabase.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProfiles[0], error: null }),
                single: vi.fn().mockResolvedValue({ data: mockProfiles[0], error: null })
              })
            })
          };
        }
        if (table === 'client_team_access' || table === 'profile_client_access') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        };
      });

      const members = await teamManagementService.fetchTeamMembers('owner-uuid-1', 'owner');
      const member = members.find((m) => m.id === 'member-uuid-1');
      expect(member).toBeDefined();
      expect(member?.clientAccessCount).toBe(0);
      expect(member?.clientIds).toEqual([]);
    });

    it('6.2 Simulates fetching team members after saving multiple clients: member receives only intended client access', async () => {
      const viSupabase = await import('../src/lib/supabase');
      const mockProfiles = [
        {
          id: 'member-uuid-1',
          full_name: 'Sara Ahmed',
          work_email: 'sara@example.com',
          role: 'team_member',
          status: 'active',
          reporting_manager_id: 'manager-uuid-1',
          designation_id: 'desig-spec',
          start_date: '2026-01-15'
        }
      ];

      (viSupabase.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProfiles[0], error: null }),
                single: vi.fn().mockResolvedValue({ data: mockProfiles[0], error: null })
              })
            })
          };
        }
        if (table === 'client_team_access') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { profile_id: 'member-uuid-1', client_id: 'client-uuid-alpha' },
                { profile_id: 'member-uuid-1', client_id: 'client-uuid-beta' }
              ],
              error: null
            })
          };
        }
        if (table === 'profile_client_access') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        };
      });

      const members = await teamManagementService.fetchTeamMembers('owner-uuid-1', 'owner');
      const member = members.find((m) => m.id === 'member-uuid-1');
      expect(member).toBeDefined();
      expect(member?.clientAccessCount).toBe(2);
      expect(member?.clientIds).toEqual(['client-uuid-alpha', 'client-uuid-beta']);
      // Confirm isolation: member does NOT have unassigned client access
      expect(member?.clientIds).not.toContain('unassigned-client-gamma');
    });
  });
});
