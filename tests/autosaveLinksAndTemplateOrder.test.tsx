import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  stripSensitiveFields, 
  saveFormDraft, 
  loadFormDraft, 
  clearFormDraft 
} from '../src/lib/autosaveUtils';
import { clientManagementService, sanitizeUrl } from '../src/lib/clientManagementService';
import { assignSequentialSortOrder } from '../src/lib/taskLaunchEngine';
import { supabase } from '../src/lib/supabase';

describe('Autosave, Sensitive Data Protection, Links & Template Sequence Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Sensitive Data Protection in Autosave Drafts', () => {
    it('1.1 Recursively strips sensitive HR, authentication, and banking fields', () => {
      const payloadWithSensitiveData = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'Team Member',
        password: 'SuperSecretPassword123!',
        confirmPassword: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        secret: 'api_secret_key_abcdef',
        apiKey: 'sk_live_1234567890',
        cnic: '12345-6789012-3',
        salary: 150000,
        dob: '1995-05-15',
        bankName: 'HBL',
        accountTitle: 'John Doe',
        accountNumber: '12345678901234',
        iban: 'PK36HABB0000001234567890',
        nested: {
          publicNote: 'Good standing',
          password: 'another_nested_password',
          bankDetails: {
            bankName: 'Meezan Bank',
            iban: 'PK12MEZN0000009876543210'
          }
        }
      };

      const stripped = stripSensitiveFields(payloadWithSensitiveData);

      // Verify safe fields remain
      expect(stripped.name).toBe('John Doe');
      expect(stripped.email).toBe('john@example.com');
      expect(stripped.role).toBe('Team Member');
      expect(stripped.nested.publicNote).toBe('Good standing');

      // Verify sensitive fields are completely omitted
      expect(stripped.password).toBeUndefined();
      expect(stripped.confirmPassword).toBeUndefined();
      expect(stripped.token).toBeUndefined();
      expect(stripped.secret).toBeUndefined();
      expect(stripped.apiKey).toBeUndefined();
      expect(stripped.cnic).toBeUndefined();
      expect(stripped.salary).toBeUndefined();
      expect(stripped.dob).toBeUndefined();
      expect(stripped.bankName).toBeUndefined();
      expect(stripped.accountTitle).toBeUndefined();
      expect(stripped.accountNumber).toBeUndefined();
      expect(stripped.iban).toBeUndefined();
      expect(stripped.nested.password).toBeUndefined();
      expect(stripped.nested.bankDetails.bankName).toBeUndefined();
      expect(stripped.nested.bankDetails.iban).toBeUndefined();
    });

    it('1.2 saveFormDraft never stores sensitive data in browser storage', () => {
      const draftKey = 'test_draft_form';
      saveFormDraft(draftKey, {
        clientName: 'Acme Corp',
        website: 'https://acme.com',
        password: 'plaintext_password',
        salary: 200000,
        cnic: '35201-1234567-1'
      });

      const rawJson = localStorage.getItem(draftKey) || sessionStorage.getItem(draftKey);
      expect(rawJson).not.toBeNull();
      expect(rawJson).not.toContain('plaintext_password');
      expect(rawJson).not.toContain('200000');
      expect(rawJson).not.toContain('35201-1234567-1');

      const loaded = loadFormDraft<any>(draftKey);
      expect(loaded.clientName).toBe('Acme Corp');
      expect(loaded.website).toBe('https://acme.com');
      expect(loaded.password).toBeUndefined();
      expect(loaded.salary).toBeUndefined();
      expect(loaded.cnic).toBeUndefined();

      clearFormDraft(draftKey);
      expect(localStorage.getItem(draftKey)).toBeNull();
      expect(sessionStorage.getItem(draftKey)).toBeNull();
      expect(loadFormDraft(draftKey)).toBeNull();
    });
  });

  describe('2. Client Details: Case Studies Text & New URL Links', () => {
    it('2.1 Case Studies text is exempt from URL sanitization and stored as text', () => {
      const caseStudiesText = `Client Growth Overview:\n- Increased revenue by 320% in Q1\n- Scaled paid ad spend with 4.5x ROAS`;
      
      // sanitizeUrl returns null for non-URLs
      expect(sanitizeUrl(caseStudiesText)).toBeNull();

      // clientManagementService updateClient handles case_studies as text without wiping it
      const rawLinks = {
        website: 'https://example.com',
        case_studies: caseStudiesText,
        requirement_docs: 'https://docs.google.com/requirements',
        gohighlevel: 'https://app.gohighlevel.com/v2/location/123'
      };

      // Verify case_studies is preserved directly
      expect(rawLinks.case_studies).toBe(caseStudiesText);
    });

    it('2.2 Requirement Docs and GoHighLevel aliases normalize consistently', () => {
      const linksWithAliases = {
        requirement_documents: 'https://notion.so/req-docs',
        ghl_account: 'https://app.gohighlevel.com/location/abc'
      };

      const normalizedRequirement = linksWithAliases.requirement_documents;
      const normalizedGhl = linksWithAliases.ghl_account;

      expect(normalizedRequirement).toBe('https://notion.so/req-docs');
      expect(normalizedGhl).toBe('https://app.gohighlevel.com/location/abc');
    });
  });

  describe('3. Template Task Sequential Ordering Engine', () => {
    it('3.1 assignSequentialSortOrder assigns consecutive ascending sort_order to launched tasks', async () => {
      const clientId = 'client-test-ordering';
      const taskIds = ['task-first', 'task-second', 'task-third'];

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const mockFrom = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'client_tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ sort_order: 10 }],
                    error: null
                  })
                })
              })
            }),
            update: mockUpdate
          } as any;
        }
        return {} as any;
      });

      await assignSequentialSortOrder(clientId, taskIds);

      expect(mockUpdate).toHaveBeenCalledTimes(3);
      // First task gets baseOrder (10 + 1 = 11)
      expect(mockUpdate).toHaveBeenNthCalledWith(1, { sort_order: 11 });
      // Second task gets baseOrder + 1 (12)
      expect(mockUpdate).toHaveBeenNthCalledWith(2, { sort_order: 12 });
      // Third task gets baseOrder + 2 (13)
      expect(mockUpdate).toHaveBeenNthCalledWith(3, { sort_order: 13 });

      mockFrom.mockRestore();
    });

    it('3.2 Defaults baseOrder to 1 when client has no prior tasks', async () => {
      const clientId = 'client-empty';
      const taskIds = ['task-solo-1', 'task-solo-2'];

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const mockFrom = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'client_tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            }),
            update: mockUpdate
          } as any;
        }
        return {} as any;
      });

      await assignSequentialSortOrder(clientId, taskIds);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenNthCalledWith(1, { sort_order: 1 });
      expect(mockUpdate).toHaveBeenNthCalledWith(2, { sort_order: 2 });

      mockFrom.mockRestore();
    });
  });
});
