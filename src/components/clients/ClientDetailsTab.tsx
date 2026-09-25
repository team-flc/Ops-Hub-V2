import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Link2, Check, AlertCircle, Save, Loader2, Plus, 
  Trash2, ExternalLink,
  Camera, Archive, X, MessageCircle, Lock
} from 'lucide-react';
import { useOpsStore } from '../../store/opsStore';
import { useDaysSinceOnboarding } from '../../lib/pktDateUtils';

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.762-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);
import { 
  ClientRecord, 
  ClientPackage, 
  ClientStatus, 
  ClientPauseReason, 
  ClientLinkType, 
  UserProfile,
  ClientLinkedInProfile 
} from '../../types';
import { 
  clientManagementService, 
  sanitizeUrl, 
  formatWhatsAppUrl,
  isValidLinkedInUrl, 
  calculateLinkedInReadiness,
  LinkedInProfileInput 
} from '../../lib/clientManagementService';
import { storageService, useSignedUrl } from '../../lib/storageService';
import { archiveService } from '../../lib/archiveService';
import { useSafeParams } from '../../lib/safeRouterHooks';
import { AutosaveBadge, AutosaveStatus } from '../../lib/autosaveUtils';

interface ClientDetailsTabProps {
  client: ClientRecord;
  currentUserProfile?: UserProfile | null;
  eligibleManagers: UserProfile[];
  onClientUpdated: (updated: ClientRecord) => void;
}

const PACKAGES: ClientPackage[] = ['Basic', 'Intermediate', 'Advanced'];
const STATUSES: ClientStatus[] = ['Onboarding', 'Active', 'Paused'];
const PAUSE_REASONS: ClientPauseReason[] = [
  'Payment overdue',
  'Client request',
  'Operational reason',
  'Other'
];

export const ClientDetailsTab: React.FC<ClientDetailsTabProps> = ({
  client,
  currentUserProfile,
  eligibleManagers,
  onClientUpdated
}) => {
  const [companyName, setCompanyName] = useState(client.companyName);
  const [clientName, setClientName] = useState(client.clientName);
  const [businessBio, setBusinessBio] = useState(client.businessBio || '');
  const [industry, setIndustry] = useState(client.industry || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logoUrl || null);
  const [pkg, setPkg] = useState<ClientPackage>(client.package);
  const [managerId, setManagerId] = useState(client.operationalManagerId);
  const [activationDate, setActivationDate] = useState(client.activationDate);
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [pauseReason, setPauseReason] = useState<ClientPauseReason>(
    client.pauseReason || 'Operational reason'
  );
  const [requiredLinkedInCount, setRequiredLinkedInCount] = useState<number>(
    client.requiredLinkedinProfileCount || 3
  );

  // Logo Upload State
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Discard Confirmation Modal State
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Links
  const [websiteUrl, setWebsiteUrl] = useState(client.links?.website || '');
  const [flcLandingPageUrl, setFlcLandingPageUrl] = useState(client.links?.flc_landing_page || '');
  const [brandIdentityUrl, setBrandIdentityUrl] = useState(client.links?.brand_identity || '');
  const [driveUrl, setDriveUrl] = useState(client.links?.google_drive || '');
  const [importantDocsUrl, setImportantDocsUrl] = useState(client.links?.important_docs || client.links?.important_documents || '');
  const [masterBusinessDocUrl, setMasterBusinessDocUrl] = useState(client.links?.master_business_doc || client.links?.master_business_document || '');
  const [staticCreativesUrl, setStaticCreativesUrl] = useState(client.links?.static_creatives || '');
  const [videosUrl, setVideosUrl] = useState(client.links?.videos || '');
  const [vslUrl, setVslUrl] = useState(client.links?.vsl || '');
  const [testimonialsUrl, setTestimonialsUrl] = useState(client.links?.testimonials || '');
  const [gridUrl, setGridUrl] = useState(client.links?.grid || '');
  const [socialMediaManagementUrl, setSocialMediaManagementUrl] = useState(client.links?.social_media_management || '');
  const [linkedinManagementUrl, setLinkedinManagementUrl] = useState(client.links?.linkedin_management || '');
  const [seoManagementUrl, setSeoManagementUrl] = useState(client.links?.seo_management || '');
  const [emailMarketingManagementUrl, setEmailMarketingManagementUrl] = useState(client.links?.email_marketing_management || '');
  const [paidAdsManagementUrl, setPaidAdsManagementUrl] = useState(client.links?.paid_ads_management || '');
  const [facebookUrl, setFacebookUrl] = useState(client.links?.facebook || '');
  const [instagramUrl, setInstagramUrl] = useState(client.links?.instagram || '');
  const [linkedinPageUrl, setLinkedinPageUrl] = useState(client.links?.linkedin_company_page || '');
  const [slackUrl, setSlackUrl] = useState(client.links?.slack_channel || '');
  const [whatsappUrl, setWhatsappUrl] = useState(client.links?.whatsapp_group || '');
  const [pocNumber, setPocNumber] = useState(client.links?.poc_number || '');
  const [caseStudiesText, setCaseStudiesText] = useState(client.links?.case_studies || '');
  const [requirementDocsUrl, setRequirementDocsUrl] = useState(client.links?.requirement_docs || client.links?.requirement_documents || '');
  const [ghlAccountUrl, setGhlAccountUrl] = useState(client.links?.gohighlevel || client.links?.ghl_account || '');

  // Autosave State & Race-Condition Sequencer
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const saveSeqRef = React.useRef(0);
  const latestCompletedSeqRef = React.useRef(0);

  // Dynamic LinkedIn Profiles State
  const [profiles, setProfiles] = useState<ClientLinkedInProfile[]>(
    client.linkedinProfiles || []
  );

  // New Profile Form Drawer/Row State
  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [newSalesNavActive, setNewSalesNavActive] = useState(false);
  const [newSalesNavDate, setNewSalesNavDate] = useState('');
  const [newLinkedinVerified, setNewLinkedinVerified] = useState(false);
  const [newHasGmailAccount, setNewHasGmailAccount] = useState(false);
  const [newGmailAddress, setNewGmailAddress] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onboardingInfo = useDaysSinceOnboarding(activationDate);
  const routeParams = useSafeParams<{ clientId?: string }>();

  // Ensure on-screen client matches URL parameter to prevent cross-client saves
  const verifyClientUrlMatch = useCallback((): boolean => {
    let pathClientId: string | undefined;
    if (typeof window !== 'undefined') {
      const pathnameMatches = window.location?.pathname?.match(/\/clients\/([a-zA-Z0-9_-]+)/);
      if (pathnameMatches) pathClientId = pathnameMatches[1];
    }
    const targetUrlId = pathClientId || routeParams.clientId;
    if (targetUrlId && targetUrlId !== client.id) {
      setErrorMsg(`Client workspace mismatch blocker: On-screen client (${client.companyName}) does not match URL client ID (${targetUrlId}). Operation halted to protect client integrity.`);
      return false;
    }
    return true;
  }, [client.id, client.companyName, routeParams.clientId]);

  // Check if form is modified from saved client prop
  const isDirty = useMemo(() => {
    if (companyName !== client.companyName) return true;
    if (clientName !== client.clientName) return true;
    if (businessBio !== (client.businessBio || '')) return true;
    if (industry !== (client.industry || '')) return true;
    if (logoUrl !== (client.logoUrl || null)) return true;
    if (pkg !== client.package) return true;
    if (managerId !== client.operationalManagerId) return true;
    if (activationDate !== client.activationDate) return true;
    if (status !== client.status) return true;
    if (status === 'Paused' && pauseReason !== (client.pauseReason || 'Operational reason')) return true;
    if (requiredLinkedInCount !== (client.requiredLinkedinProfileCount || 3)) return true;
    if (websiteUrl !== (client.links?.website || '')) return true;
    if (flcLandingPageUrl !== (client.links?.flc_landing_page || '')) return true;
    if (brandIdentityUrl !== (client.links?.brand_identity || '')) return true;
    if (driveUrl !== (client.links?.google_drive || '')) return true;
    if (importantDocsUrl !== (client.links?.important_docs || client.links?.important_documents || '')) return true;
    if (masterBusinessDocUrl !== (client.links?.master_business_doc || client.links?.master_business_document || '')) return true;
    if (staticCreativesUrl !== (client.links?.static_creatives || '')) return true;
    if (videosUrl !== (client.links?.videos || '')) return true;
    if (vslUrl !== (client.links?.vsl || '')) return true;
    if (testimonialsUrl !== (client.links?.testimonials || '')) return true;
    if (gridUrl !== (client.links?.grid || '')) return true;
    if (socialMediaManagementUrl !== (client.links?.social_media_management || '')) return true;
    if (linkedinManagementUrl !== (client.links?.linkedin_management || '')) return true;
    if (seoManagementUrl !== (client.links?.seo_management || '')) return true;
    if (emailMarketingManagementUrl !== (client.links?.email_marketing_management || '')) return true;
    if (paidAdsManagementUrl !== (client.links?.paid_ads_management || '')) return true;
    if (facebookUrl !== (client.links?.facebook || '')) return true;
    if (instagramUrl !== (client.links?.instagram || '')) return true;
    if (linkedinPageUrl !== (client.links?.linkedin_company_page || '')) return true;
    if (slackUrl !== (client.links?.slack_channel || '')) return true;
    if (whatsappUrl !== (client.links?.whatsapp_group || '')) return true;
    if (pocNumber !== (client.links?.poc_number || client.links?.poc_whatsapp || '')) return true;
    if (caseStudiesText !== (client.links?.case_studies || '')) return true;
    if (requirementDocsUrl !== (client.links?.requirement_docs || client.links?.requirement_documents || '')) return true;
    if (ghlAccountUrl !== (client.links?.gohighlevel || client.links?.ghl_account || '')) return true;
    return false;
  }, [
    companyName, clientName, businessBio, industry, logoUrl, pkg, managerId,
    activationDate, status, pauseReason, requiredLinkedInCount,
    websiteUrl, flcLandingPageUrl, brandIdentityUrl, driveUrl, importantDocsUrl, masterBusinessDocUrl, staticCreativesUrl,
    videosUrl, vslUrl, testimonialsUrl, gridUrl, socialMediaManagementUrl, linkedinManagementUrl, seoManagementUrl,
    emailMarketingManagementUrl, paidAdsManagementUrl, facebookUrl, instagramUrl, linkedinPageUrl,
    slackUrl, whatsappUrl, pocNumber, caseStudiesText, requirementDocsUrl, ghlAccountUrl, client
  ]);

  // Load draft if present in sessionStorage, else initialize from client prop
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(`ops_hub_client_links_draft_${client.id}`);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setCompanyName(parsed.companyName ?? client.companyName);
        setClientName(parsed.clientName ?? client.clientName);
        setBusinessBio(parsed.businessBio ?? (client.businessBio || ''));
        setIndustry(parsed.industry ?? (client.industry || ''));
        setLogoUrl(parsed.logoUrl !== undefined ? parsed.logoUrl : (client.logoUrl || null));
        setPkg(parsed.pkg ?? client.package);
        setManagerId(parsed.managerId ?? client.operationalManagerId);
        setActivationDate(parsed.activationDate ?? client.activationDate);
        setStatus(parsed.status ?? client.status);
        setPauseReason(parsed.pauseReason ?? (client.pauseReason || 'Operational reason'));
        setRequiredLinkedInCount(parsed.requiredLinkedInCount ?? (client.requiredLinkedinProfileCount || 3));
        setWebsiteUrl(parsed.websiteUrl ?? (client.links?.website || ''));
        setFlcLandingPageUrl(parsed.flcLandingPageUrl ?? (client.links?.flc_landing_page || ''));
        setBrandIdentityUrl(parsed.brandIdentityUrl ?? (client.links?.brand_identity || ''));
        setDriveUrl(parsed.driveUrl ?? (client.links?.google_drive || ''));
        setImportantDocsUrl(parsed.importantDocsUrl ?? (client.links?.important_docs || client.links?.important_documents || ''));
        setMasterBusinessDocUrl(parsed.masterBusinessDocUrl ?? (client.links?.master_business_doc || client.links?.master_business_document || ''));
        setStaticCreativesUrl(parsed.staticCreativesUrl ?? (client.links?.static_creatives || ''));
        setVideosUrl(parsed.videosUrl ?? (client.links?.videos || ''));
        setVslUrl(parsed.vslUrl ?? (client.links?.vsl || ''));
        setTestimonialsUrl(parsed.testimonialsUrl ?? (client.links?.testimonials || ''));
        setGridUrl(parsed.gridUrl ?? (client.links?.grid || ''));
        setSocialMediaManagementUrl(parsed.socialMediaManagementUrl ?? (client.links?.social_media_management || ''));
        setLinkedinManagementUrl(parsed.linkedinManagementUrl ?? (client.links?.linkedin_management || ''));
        setSeoManagementUrl(parsed.seoManagementUrl ?? (client.links?.seo_management || ''));
        setEmailMarketingManagementUrl(parsed.emailMarketingManagementUrl ?? (client.links?.email_marketing_management || ''));
        setPaidAdsManagementUrl(parsed.paidAdsManagementUrl ?? (client.links?.paid_ads_management || ''));
        setFacebookUrl(parsed.facebookUrl ?? (client.links?.facebook || ''));
        setInstagramUrl(parsed.instagramUrl ?? (client.links?.instagram || ''));
        setLinkedinPageUrl(parsed.linkedinPageUrl ?? (client.links?.linkedin_company_page || ''));
        setSlackUrl(parsed.slackUrl ?? (client.links?.slack_channel || ''));
        setWhatsappUrl(parsed.whatsappUrl ?? (client.links?.whatsapp_group || ''));
        setPocNumber(parsed.pocNumber ?? (client.links?.poc_number || client.links?.poc_whatsapp || ''));
        setCaseStudiesText(parsed.caseStudiesText ?? (client.links?.case_studies || ''));
        setRequirementDocsUrl(parsed.requirementDocsUrl ?? (client.links?.requirement_docs || client.links?.requirement_documents || ''));
        setGhlAccountUrl(parsed.ghlAccountUrl ?? (client.links?.gohighlevel || client.links?.ghl_account || ''));
        setProfiles(client.linkedinProfiles || []);
        return;
      }
    } catch {
      // Ignore parse errors and fallback to client prop
    }

    setCompanyName(client.companyName);
    setClientName(client.clientName);
    setBusinessBio(client.businessBio || '');
    setIndustry(client.industry || '');
    setLogoUrl(client.logoUrl || null);
    setPkg(client.package);
    setManagerId(client.operationalManagerId);
    setActivationDate(client.activationDate);
    setStatus(client.status);
    setPauseReason(client.pauseReason || 'Operational reason');
    setRequiredLinkedInCount(client.requiredLinkedinProfileCount || 3);
    setWebsiteUrl(client.links?.website || '');
    setFlcLandingPageUrl(client.links?.flc_landing_page || '');
    setBrandIdentityUrl(client.links?.brand_identity || '');
    setDriveUrl(client.links?.google_drive || '');
    setImportantDocsUrl(client.links?.important_docs || client.links?.important_documents || '');
    setMasterBusinessDocUrl(client.links?.master_business_doc || client.links?.master_business_document || '');
    setStaticCreativesUrl(client.links?.static_creatives || '');
    setVideosUrl(client.links?.videos || '');
    setVslUrl(client.links?.vsl || '');
    setTestimonialsUrl(client.links?.testimonials || '');
    setGridUrl(client.links?.grid || '');
    setSocialMediaManagementUrl(client.links?.social_media_management || '');
    setLinkedinManagementUrl(client.links?.linkedin_management || '');
    setSeoManagementUrl(client.links?.seo_management || '');
    setEmailMarketingManagementUrl(client.links?.email_marketing_management || '');
    setPaidAdsManagementUrl(client.links?.paid_ads_management || '');
    setFacebookUrl(client.links?.facebook || '');
    setInstagramUrl(client.links?.instagram || '');
    setLinkedinPageUrl(client.links?.linkedin_company_page || '');
    setSlackUrl(client.links?.slack_channel || '');
    setWhatsappUrl(client.links?.whatsapp_group || '');
    setPocNumber(client.links?.poc_number || client.links?.poc_whatsapp || '');
    setCaseStudiesText(client.links?.case_studies || '');
    setRequirementDocsUrl(client.links?.requirement_docs || client.links?.requirement_documents || '');
    setGhlAccountUrl(client.links?.gohighlevel || client.links?.ghl_account || '');
    setProfiles(client.linkedinProfiles || []);
  }, [client]);

  // Persist or clean up draft in sessionStorage
  useEffect(() => {
    const draftKey = `ops_hub_client_links_draft_${client.id}`;
    if (isDirty) {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            companyName,
            clientName,
            businessBio,
            industry,
            logoUrl,
            pkg,
            managerId,
            activationDate,
            status,
            pauseReason,
            requiredLinkedInCount,
            websiteUrl,
            flcLandingPageUrl,
            brandIdentityUrl,
            driveUrl,
            importantDocsUrl,
            masterBusinessDocUrl,
            staticCreativesUrl,
            videosUrl,
            vslUrl,
            testimonialsUrl,
            gridUrl,
            socialMediaManagementUrl,
            linkedinManagementUrl,
            seoManagementUrl,
            emailMarketingManagementUrl,
            paidAdsManagementUrl,
            facebookUrl,
            instagramUrl,
            linkedinPageUrl,
            slackUrl,
            whatsappUrl,
            pocNumber
          })
        );
      } catch {
        // Storage might be disabled or full
      }
    } else {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    }
  }, [
    isDirty, client.id, companyName, clientName, businessBio, industry, logoUrl,
    pkg, managerId, activationDate, status, pauseReason, requiredLinkedInCount,
    websiteUrl, flcLandingPageUrl, brandIdentityUrl, driveUrl, importantDocsUrl, masterBusinessDocUrl, staticCreativesUrl,
    videosUrl, vslUrl, testimonialsUrl, gridUrl, socialMediaManagementUrl, linkedinManagementUrl, seoManagementUrl,
    emailMarketingManagementUrl, paidAdsManagementUrl, facebookUrl, instagramUrl, linkedinPageUrl,
    slackUrl, whatsappUrl, pocNumber, caseStudiesText, requirementDocsUrl, ghlAccountUrl
  ]);

  const handleConfirmDiscard = () => {
    try {
      sessionStorage.removeItem(`ops_hub_client_links_draft_${client.id}`);
    } catch {}

    setCompanyName(client.companyName);
    setClientName(client.clientName);
    setBusinessBio(client.businessBio || '');
    setIndustry(client.industry || '');
    setLogoUrl(client.logoUrl || null);
    setPkg(client.package);
    setManagerId(client.operationalManagerId);
    setActivationDate(client.activationDate);
    setStatus(client.status);
    setPauseReason(client.pauseReason || 'Operational reason');
    setRequiredLinkedInCount(client.requiredLinkedinProfileCount || 3);
    setWebsiteUrl(client.links?.website || '');
    setFlcLandingPageUrl(client.links?.flc_landing_page || '');
    setBrandIdentityUrl(client.links?.brand_identity || '');
    setDriveUrl(client.links?.google_drive || '');
    setImportantDocsUrl(client.links?.important_docs || client.links?.important_documents || '');
    setMasterBusinessDocUrl(client.links?.master_business_doc || client.links?.master_business_document || '');
    setStaticCreativesUrl(client.links?.static_creatives || '');
    setVideosUrl(client.links?.videos || '');
    setVslUrl(client.links?.vsl || '');
    setTestimonialsUrl(client.links?.testimonials || '');
    setGridUrl(client.links?.grid || '');
    setSocialMediaManagementUrl(client.links?.social_media_management || '');
    setLinkedinManagementUrl(client.links?.linkedin_management || '');
    setSeoManagementUrl(client.links?.seo_management || '');
    setEmailMarketingManagementUrl(client.links?.email_marketing_management || '');
    setPaidAdsManagementUrl(client.links?.paid_ads_management || '');
    setFacebookUrl(client.links?.facebook || '');
    setInstagramUrl(client.links?.instagram || '');
    setLinkedinPageUrl(client.links?.linkedin_company_page || '');
    setSlackUrl(client.links?.slack_channel || '');
    setWhatsappUrl(client.links?.whatsapp_group || '');
    setPocNumber(client.links?.poc_number || client.links?.poc_whatsapp || '');
    setCaseStudiesText(client.links?.case_studies || '');
    setRequirementDocsUrl(client.links?.requirement_docs || client.links?.requirement_documents || '');
    setGhlAccountUrl(client.links?.gohighlevel || client.links?.ghl_account || '');
    setErrorMsg(null);
    setAutosaveStatus('idle');
    setAutosaveError(null);
    setShowDiscardModal(false);
  };

  const isTeamMember = currentUserProfile?.role === 'team_member';
  const isManagerOrOwner = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'operational_manager';
  const readiness = calculateLinkedInReadiness(requiredLinkedInCount, profiles);
  const displayLogoUrl = useSignedUrl('client-logos', logoUrl);

  const isBioLocked = isTeamMember && Boolean(client.businessBio?.trim());
  const isIndustryLocked = isTeamMember && Boolean(client.industry?.trim());

  const isLinkLocked = (linkKey: ClientLinkType | string) => {
    if (!isTeamMember) return false;
    let existing: string | undefined;
    if (linkKey === 'important_docs' || linkKey === 'important_documents') {
      existing = client.links?.important_docs || client.links?.important_documents;
    } else if (linkKey === 'master_business_doc' || linkKey === 'master_business_document') {
      existing = client.links?.master_business_doc || client.links?.master_business_document;
    } else if (linkKey === 'poc_number' || linkKey === 'poc_whatsapp') {
      existing = client.links?.poc_number || client.links?.poc_whatsapp;
    } else {
      existing = client.links?.[linkKey as ClientLinkType];
    }
    return Boolean(existing && existing.trim());
  };

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = storageService.validateImage(file);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Invalid logo image.');
      return;
    }
    setIsUploadingLogo(true);
    setErrorMsg(null);
    try {
      const res = await storageService.uploadClientLogo(file, client.id);
      if (res.error || !res.path) {
        setErrorMsg(res.error || 'Failed to upload client logo.');
      } else {
        setLogoUrl(res.path);
        setSuccessMsg('Logo uploaded successfully. Click "Save Changes" to apply.');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error uploading logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Archive Client Handler
  const handleArchiveClient = async () => {
    if (!archiveReason.trim()) {
      setArchiveError('Mandatory archive reason is required.');
      return;
    }
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const res = await archiveService.archiveClient(client.id, archiveReason.trim());
      if (res.error || !res.success) {
        setArchiveError(res.error || 'Failed to archive client.');
      } else {
        setShowArchiveModal(false);
        onClientUpdated({
          ...client,
          status: 'Archived',
          archivedAt: new Date().toISOString(),
          archiveReason: archiveReason.trim()
        });
      }
    } catch (err: any) {
      setArchiveError(err?.message || 'Error archiving client.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Core save routine with race-condition guards
  const performSave = useCallback(
    async (isManualClick = false): Promise<boolean> => {
      if (!verifyClientUrlMatch()) {
        return false;
      }

      if (!companyName.trim()) {
        if (isManualClick) setErrorMsg('Company Name is required.');
        return false;
      }
      if (!clientName.trim()) {
        if (isManualClick) setErrorMsg('Client/Owner Name is required.');
        return false;
      }

      const rawLinks: Partial<Record<ClientLinkType, string>> = {
        website: websiteUrl,
        flc_landing_page: flcLandingPageUrl,
        brand_identity: brandIdentityUrl,
        google_drive: driveUrl,
        important_docs: importantDocsUrl,
        important_documents: importantDocsUrl,
        master_business_doc: masterBusinessDocUrl,
        master_business_document: masterBusinessDocUrl,
        static_creatives: staticCreativesUrl,
        videos: videosUrl,
        vsl: vslUrl,
        testimonials: testimonialsUrl,
        grid: gridUrl,
        social_media_management: socialMediaManagementUrl,
        linkedin_management: linkedinManagementUrl,
        seo_management: seoManagementUrl,
        email_marketing_management: emailMarketingManagementUrl,
        paid_ads_management: paidAdsManagementUrl,
        facebook: facebookUrl,
        instagram: instagramUrl,
        linkedin_company_page: linkedinPageUrl,
        slack_channel: slackUrl,
        whatsapp_group: whatsappUrl,
        poc_number: pocNumber,
        poc_whatsapp: pocNumber,
        case_studies: caseStudiesText,
        requirement_docs: requirementDocsUrl,
        requirement_documents: requirementDocsUrl,
        gohighlevel: ghlAccountUrl,
        ghl_account: ghlAccountUrl
      };

      for (const [key, raw] of Object.entries(rawLinks)) {
        if (raw && raw.trim()) {
          // Exempt poc_number, poc_whatsapp, and case_studies from URL check
          if (key === 'poc_number' || key === 'poc_whatsapp' || key === 'case_studies') {
            continue;
          }
          const sanitized = sanitizeUrl(raw);
          if (!sanitized) {
            if (isManualClick) {
              setErrorMsg(`Invalid URL for ${key.replace(/_/g, ' ')}. Only http:// and https:// URLs are allowed.`);
            }
            return false;
          }
        }
      }

      const currentSeq = ++saveSeqRef.current;
      if (isManualClick) {
        setIsSaving(true);
        setErrorMsg(null);
        setSuccessMsg(null);
      }
      setAutosaveStatus('saving');
      setAutosaveError(null);

      try {
        const result = await clientManagementService.updateClient(
          client.id,
          {
            companyName: companyName.trim(),
            clientName: clientName.trim(),
            businessBio: businessBio.trim() || null,
            industry: industry.trim() || null,
            logoUrl: logoUrl || null,
            package: pkg,
            operationalManagerId: managerId,
            activationDate,
            status,
            pauseReason: status === 'Paused' ? pauseReason : null,
            requiredLinkedinProfileCount: Math.max(1, requiredLinkedInCount),
            links: rawLinks
          },
          currentUserProfile?.id
        );

        // Sequence guard: if an earlier request arrives after a newer save has finished, ignore
        if (currentSeq < latestCompletedSeqRef.current) {
          return false;
        }
        latestCompletedSeqRef.current = currentSeq;

        if (result.error || !result.data) {
          setAutosaveStatus('failed');
          setAutosaveError(result.error || 'Failed to save changes.');
          if (isManualClick) {
            setErrorMsg(result.error || 'Failed to update client details.');
          }
          return false;
        }

        try {
          sessionStorage.removeItem(`ops_hub_client_links_draft_${client.id}`);
        } catch {}

        setAutosaveStatus('saved');
        setAutosaveError(null);
        if (isManualClick) {
          setSuccessMsg('Client configuration updated successfully.');
          setTimeout(() => setSuccessMsg(null), 3000);
        }
        useOpsStore.getState().updateClientRecord(result.data);
        onClientUpdated(result.data);
        return true;
      } catch (err: any) {
        if (currentSeq >= latestCompletedSeqRef.current) {
          latestCompletedSeqRef.current = currentSeq;
          setAutosaveStatus('failed');
          setAutosaveError(err?.message || 'Failed to auto-save.');
          if (isManualClick) {
            setErrorMsg(err?.message || 'An unexpected error occurred.');
          }
        }
        return false;
      } finally {
        if (isManualClick) {
          setIsSaving(false);
        }
      }
    },
    [
      client.id, companyName, clientName, businessBio, industry, logoUrl, pkg, managerId,
      activationDate, status, pauseReason, requiredLinkedInCount,
      websiteUrl, flcLandingPageUrl, brandIdentityUrl, driveUrl, importantDocsUrl, masterBusinessDocUrl,
      staticCreativesUrl, videosUrl, vslUrl, testimonialsUrl, gridUrl, socialMediaManagementUrl,
      linkedinManagementUrl, seoManagementUrl, emailMarketingManagementUrl, paidAdsManagementUrl,
      facebookUrl, instagramUrl, linkedinPageUrl, slackUrl, whatsappUrl, pocNumber,
      caseStudiesText, requirementDocsUrl, ghlAccountUrl, currentUserProfile?.id, onClientUpdated,
      verifyClientUrlMatch
    ]
  );

  // Debounced Autosave Effect for valid changes
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    if (!companyName.trim() || !clientName.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      performSave(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isDirty, performSave, companyName, clientName]);

  // Save Core Client Details and Workspace Links via manual click
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave(true);
  };

  // Add a new LinkedIn Profile
  const handleAddNewProfile = async () => {
    setErrorMsg(null);

    if (!verifyClientUrlMatch()) {
      return;
    }

    if (!newProfileUrl.trim()) {
      setErrorMsg('LinkedIn Profile URL is required.');
      return;
    }

    const cleanUrl = sanitizeUrl(newProfileUrl);
    if (!cleanUrl || !isValidLinkedInUrl(cleanUrl)) {
      setErrorMsg('Invalid LinkedIn Profile URL. Must be a valid http/https LinkedIn URL.');
      return;
    }

    const resolvedSalesNavDate = newSalesNavActive
      ? (newSalesNavDate || new Date().toISOString().split('T')[0])
      : null;

    setIsAddingProfile(true);

    try {
      const res = await clientManagementService.addLinkedInProfile(
        client.id,
        {
          profileLabel: newProfileLabel.trim() || `LinkedIn ID ${profiles.length + 1}`,
          profileUrl: cleanUrl,
          salesNavigatorActive: newSalesNavActive,
          salesNavigatorActivatedOn: resolvedSalesNavDate,
          linkedinVerified: newLinkedinVerified,
          hasGmailAccount: newHasGmailAccount,
          gmailAddress: newHasGmailAccount ? (newGmailAddress.trim() || null) : null,
          sortOrder: profiles.length
        },
        currentUserProfile?.id
      );

      if (res.error || !res.data) {
        setErrorMsg(res.error || 'Failed to add LinkedIn profile.');
        setIsAddingProfile(false);
        return;
      }

      const updatedProfiles = [...profiles, res.data];
      setProfiles(updatedProfiles);
      onClientUpdated({
        ...client,
        linkedinProfiles: updatedProfiles
      });

      setNewProfileLabel('');
      setNewProfileUrl('');
      setNewSalesNavActive(false);
      setNewSalesNavDate('');
      setNewLinkedinVerified(false);
      setNewHasGmailAccount(false);
      setNewGmailAddress('');
      setIsAddingProfile(false);
      setSuccessMsg('LinkedIn profile added successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error adding profile.');
      setIsAddingProfile(false);
    }
  };

  // Toggle or update existing LinkedIn profile
  const handleUpdateProfile = async (profileId: string, updates: Partial<LinkedInProfileInput>) => {
    if (!verifyClientUrlMatch()) {
      return;
    }

    // Capture previous state for rollback on error
    const previousProfiles = profiles;

    // Apply optimistic update immediately so checkbox stays checked and child inputs reveal with zero lag
    const optimisticProfiles = profiles.map((p) => {
      if (p.id !== profileId) return p;
      const nextSalesNav = updates.salesNavigatorActive !== undefined ? updates.salesNavigatorActive : p.salesNavigatorActive;
      const nextSalesNavDate = updates.salesNavigatorActivatedOn !== undefined ? updates.salesNavigatorActivatedOn : (
        nextSalesNav ? (p.salesNavigatorActivatedOn || new Date().toISOString().split('T')[0]) : null
      );
      const nextHasGmail = updates.hasGmailAccount !== undefined ? updates.hasGmailAccount : p.hasGmailAccount;
      const nextGmailAddress = updates.gmailAddress !== undefined ? updates.gmailAddress : (
        nextHasGmail === false ? null : p.gmailAddress
      );

      return {
        ...p,
        profileLabel: updates.profileLabel !== undefined ? updates.profileLabel : p.profileLabel,
        profileUrl: updates.profileUrl !== undefined ? updates.profileUrl : p.profileUrl,
        salesNavigatorActive: nextSalesNav,
        salesNavigatorActivatedOn: nextSalesNavDate,
        linkedinVerified: updates.linkedinVerified !== undefined ? updates.linkedinVerified : p.linkedinVerified,
        hasGmailAccount: nextHasGmail,
        gmailAddress: nextGmailAddress
      };
    });

    setProfiles(optimisticProfiles);
    setErrorMsg(null);

    // Sync optimistic state to parent record to prevent [client] useEffect revert
    onClientUpdated({
      ...client,
      linkedinProfiles: optimisticProfiles
    });

    try {
      const res = await clientManagementService.updateLinkedInProfile(
        profileId,
        updates,
        currentUserProfile?.id
      );

      if (res.error) {
        setProfiles(previousProfiles);
        onClientUpdated({
          ...client,
          linkedinProfiles: previousProfiles
        });
        setErrorMsg(res.error);
        return;
      }

      if (res.data) {
        const confirmedProfiles = profiles.map((p) => (p.id === profileId ? res.data! : p));
        setProfiles(confirmedProfiles);
        onClientUpdated({
          ...client,
          linkedinProfiles: confirmedProfiles
        });
      }
    } catch (err: any) {
      setProfiles(previousProfiles);
      onClientUpdated({
        ...client,
        linkedinProfiles: previousProfiles
      });
      setErrorMsg(err?.message || 'Failed to update LinkedIn profile.');
    }
  };

  // Archive LinkedIn profile
  const handleArchiveProfile = async (profileId: string) => {
    try {
      const res = await clientManagementService.archiveLinkedInProfile(
        profileId,
        currentUserProfile?.id
      );
      if (res.success) {
        const updatedProfiles = profiles.filter((p) => p.id !== profileId);
        setProfiles(updatedProfiles);
        onClientUpdated({
          ...client,
          linkedinProfiles: updatedProfiles
        });
        setSuccessMsg('Profile archived.');
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to archive profile.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-16">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Core Information & Communication Channels Form */}
      <form onSubmit={handleSaveDetails} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Client Details & Configuration
              </h3>
              {isDirty && (
                <span
                  data-testid="unsaved-changes-indicator"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-fade-in"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage client workspace information, assigned managers, and communication channels.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <AutosaveBadge status={autosaveStatus} error={autosaveError} />

            {isDirty && (
              <button
                type="button"
                onClick={() => setShowDiscardModal(true)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Discard Changes
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Client Brand Identity & Logo */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-dark-border space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Brand Logo & Organization Assets</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative group flex-shrink-0">
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt={companyName}
                  className="w-16 h-16 rounded-2xl object-contain border border-gray-200 dark:border-dark-border p-1 bg-white shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-700 text-white font-black text-lg flex items-center justify-center shadow-sm">
                  {companyName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CL'}
                </div>
              )}
              {!isTeamMember && (
                <label
                  htmlFor="client-logo-upload"
                  className="absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-all duration-200 text-center p-1"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span className="text-[8px] font-bold leading-tight">Change</span>
                    </>
                  )}
                </label>
              )}
              <input
                id="client-logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={isTeamMember || isUploadingLogo || isSaving}
              />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Client Brand Logo
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-md">
                Displayed in the Client Switcher, header breadcrumbs, and task workspaces. Allowed: JPG, PNG, WebP up to 5MB.
              </p>
              {logoUrl && !isTeamMember && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold inline-flex items-center gap-1 mt-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Core Client Information */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Account Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-company-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="detail-company-name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-client-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Client / Owner Full Name <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="detail-client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Industry / Category */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-industry" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Industry / Category
                </label>
                {isIndustryLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="detail-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isIndustryLocked}
                placeholder="e.g. B2B SaaS, E-Commerce, Logistics"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Service Package */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-package" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Service Package <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <select
                id="detail-package"
                value={pkg}
                onChange={(e) => setPkg(e.target.value as ClientPackage)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-manager" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Operational Manager <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <select
                id="detail-manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {eligibleManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.role === 'owner' ? 'Owner' : 'Operational Manager'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-activation-date" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Project Start Date <span className="text-rose-500">*</span>
                </label>
                {isTeamMember ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                ) : !onboardingInfo.isMissing ? (
                  <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400">
                    {onboardingInfo.badgeLabel}
                  </span>
                ) : null}
              </div>
              <input
                id="detail-activation-date"
                type="date"
                value={activationDate}
                onChange={(e) => setActivationDate(e.target.value)}
                disabled={isTeamMember}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {onboardingInfo.formattedBadge}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-status" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Lifecycle Status <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <select
                id="detail-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Required LinkedIn Count */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-req-count" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Required LinkedIn Profiles Count <span className="text-rose-500">*</span>
                </label>
                {isTeamMember && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="detail-req-count"
                type="number"
                min="1"
                max="20"
                value={requiredLinkedInCount}
                onChange={(e) => setRequiredLinkedInCount(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Business Bio / Description */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="detail-business-bio" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Business Bio / "What the client does"
                </label>
                {isBioLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <textarea
                id="detail-business-bio"
                rows={3}
                value={businessBio}
                onChange={(e) => setBusinessBio(e.target.value)}
                disabled={isBioLocked}
                placeholder="Brief description of the client's business model, target audience, and primary service offerings..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {status === 'Paused' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
              <label htmlFor="detail-pause-reason" className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                Pause Reason <span className="text-rose-500">*</span>
              </label>
              <select
                id="detail-pause-reason"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value as ClientPauseReason)}
                disabled={isTeamMember}
                className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-60"
              >
                {PAUSE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section 2: Expanded Workspace & Communication Links */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-dark-border">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            <span>Workspace & Communication Channels</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-website" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Website URL
                </label>
                {isLinkLocked('website') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={isLinkLocked('website')}
                placeholder="https://clientwebsite.com"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-flc-landing-page" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  FLC Landing Page URL
                </label>
                {isLinkLocked('flc_landing_page') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-flc-landing-page"
                type="url"
                value={flcLandingPageUrl}
                onChange={(e) => setFlcLandingPageUrl(e.target.value)}
                disabled={isLinkLocked('flc_landing_page')}
                placeholder="https://flc-landing-page.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-brand-identity" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Brand Identity URL
                </label>
                {isLinkLocked('brand_identity') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-brand-identity"
                type="url"
                value={brandIdentityUrl}
                onChange={(e) => setBrandIdentityUrl(e.target.value)}
                disabled={isLinkLocked('brand_identity')}
                placeholder="https://... (Brand Identity Guidelines / Assets)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-drive" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Google Drive Folder URL
                </label>
                {isLinkLocked('google_drive') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-drive"
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                disabled={isLinkLocked('google_drive')}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-important-docs" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Important Documents URL
                </label>
                {isLinkLocked('important_docs') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-important-docs"
                data-testid="edit-important-docs"
                type="url"
                value={importantDocsUrl}
                onChange={(e) => setImportantDocsUrl(e.target.value)}
                disabled={isLinkLocked('important_docs')}
                placeholder="https://... (Important Documents / Notion / Google Doc Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-master-business-doc" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Master Business Document URL
                </label>
                {isLinkLocked('master_business_doc') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-master-business-doc"
                data-testid="edit-master-business-doc"
                type="url"
                value={masterBusinessDocUrl}
                onChange={(e) => setMasterBusinessDocUrl(e.target.value)}
                disabled={isLinkLocked('master_business_doc')}
                placeholder="https://... (Master Business Document Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-static-creatives" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Static Creatives URL
                </label>
                {isLinkLocked('static_creatives') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-static-creatives"
                type="url"
                value={staticCreativesUrl}
                onChange={(e) => setStaticCreativesUrl(e.target.value)}
                disabled={isLinkLocked('static_creatives')}
                placeholder="https://... (Static Creatives / Ads Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-videos" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Videos URL
                </label>
                {isLinkLocked('videos') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-videos"
                type="url"
                value={videosUrl}
                onChange={(e) => setVideosUrl(e.target.value)}
                disabled={isLinkLocked('videos')}
                placeholder="https://... (Video Ads / Creatives Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-vsl" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  VSL (Video Sales Letter) URL
                </label>
                {isLinkLocked('vsl') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-vsl"
                type="url"
                value={vslUrl}
                onChange={(e) => setVslUrl(e.target.value)}
                disabled={isLinkLocked('vsl')}
                placeholder="https://... (VSL Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-testimonials" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Testimonials (Videos) URL
                </label>
                {isLinkLocked('testimonials') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-testimonials"
                data-testid="edit-testimonials"
                type="url"
                value={testimonialsUrl}
                onChange={(e) => setTestimonialsUrl(e.target.value)}
                disabled={isLinkLocked('testimonials')}
                placeholder="https://... (Testimonials Video Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-case-studies" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Case Studies (Text)
                </label>
                {isLinkLocked('case_studies') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <textarea
                id="edit-case-studies"
                data-testid="edit-case-studies"
                rows={3}
                value={caseStudiesText}
                onChange={(e) => setCaseStudiesText(e.target.value)}
                disabled={isLinkLocked('case_studies')}
                placeholder="Enter client case studies text / overview..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-requirement-docs" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Requirement Documents URL
                </label>
                {isLinkLocked('requirement_docs') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-requirement-docs"
                data-testid="edit-requirement-docs"
                type="url"
                value={requirementDocsUrl}
                onChange={(e) => setRequirementDocsUrl(e.target.value)}
                disabled={isLinkLocked('requirement_docs')}
                placeholder="https://... (Requirement Documents Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-gohighlevel" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  GoHighLevel Account URL
                </label>
                {isLinkLocked('gohighlevel') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-gohighlevel"
                data-testid="edit-gohighlevel"
                type="url"
                value={ghlAccountUrl}
                onChange={(e) => setGhlAccountUrl(e.target.value)}
                disabled={isLinkLocked('gohighlevel')}
                placeholder="https://app.gohighlevel.com/... (GHL Account Link - No credentials stored)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-grid" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Grid URL
                </label>
                {isLinkLocked('grid') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-grid"
                type="url"
                value={gridUrl}
                onChange={(e) => setGridUrl(e.target.value)}
                disabled={isLinkLocked('grid')}
                placeholder="https://... (Grid Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-social-media-management" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Social Media Management URL
                </label>
                {isLinkLocked('social_media_management') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-social-media-management"
                data-testid="edit-social-media-management"
                type="url"
                value={socialMediaManagementUrl}
                onChange={(e) => setSocialMediaManagementUrl(e.target.value)}
                disabled={isLinkLocked('social_media_management')}
                placeholder="https://... (Social Media Management / Buffer / Hootsuite Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-linkedin-management" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  LinkedIn Management URL
                </label>
                {isLinkLocked('linkedin_management') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-linkedin-management"
                data-testid="edit-linkedin-management"
                type="url"
                value={linkedinManagementUrl}
                onChange={(e) => setLinkedinManagementUrl(e.target.value)}
                disabled={isLinkLocked('linkedin_management')}
                placeholder="https://... (LinkedIn Management / Campaign Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-seo-management" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  SEO Management URL
                </label>
                {isLinkLocked('seo_management') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-seo-management"
                data-testid="edit-seo-management"
                type="url"
                value={seoManagementUrl}
                onChange={(e) => setSeoManagementUrl(e.target.value)}
                disabled={isLinkLocked('seo_management')}
                placeholder="https://... (SEO Management / Ahrefs / SEMrush / Dashboard Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-email-marketing-management" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Email Marketing Management URL
                </label>
                {isLinkLocked('email_marketing_management') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-email-marketing-management"
                data-testid="edit-email-marketing-management"
                type="url"
                value={emailMarketingManagementUrl}
                onChange={(e) => setEmailMarketingManagementUrl(e.target.value)}
                disabled={isLinkLocked('email_marketing_management')}
                placeholder="https://... (Email Marketing / Klaviyo / Mailchimp Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-paid-ads-management" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Paid Ads Management URL
                </label>
                {isLinkLocked('paid_ads_management') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-paid-ads-management"
                data-testid="edit-paid-ads-management"
                type="url"
                value={paidAdsManagementUrl}
                onChange={(e) => setPaidAdsManagementUrl(e.target.value)}
                disabled={isLinkLocked('paid_ads_management')}
                placeholder="https://... (Paid Ads Management / Meta Ads / Google Ads Link)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-linkedin-page" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  LinkedIn Company Page URL
                </label>
                {isLinkLocked('linkedin_company_page') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-linkedin-page"
                type="url"
                value={linkedinPageUrl}
                onChange={(e) => setLinkedinPageUrl(e.target.value)}
                disabled={isLinkLocked('linkedin_company_page')}
                placeholder="https://linkedin.com/company/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-facebook" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Facebook Page URL
                </label>
                {isLinkLocked('facebook') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-facebook"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                disabled={isLinkLocked('facebook')}
                placeholder="https://facebook.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-instagram" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Instagram Page URL
                </label>
                {isLinkLocked('instagram') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-instagram"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                disabled={isLinkLocked('instagram')}
                placeholder="https://instagram.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-slack" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Slack Channel URL
                </label>
                {isLinkLocked('slack_channel') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-slack"
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                disabled={isLinkLocked('slack_channel')}
                placeholder="https://app.slack.com/client/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-whatsapp" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  WhatsApp Group URL
                </label>
                {isLinkLocked('whatsapp_group') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                )}
              </div>
              <input
                id="edit-whatsapp"
                type="url"
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                disabled={isLinkLocked('whatsapp_group')}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-poc-number" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  POC Number / WhatsApp
                </label>
                {isLinkLocked('poc_number') ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Set by Management</span>
                  </span>
                ) : pocNumber.trim() && formatWhatsAppUrl(pocNumber) ? (
                  <a
                    href={formatWhatsAppUrl(pocNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="poc-direct-whatsapp-link"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    title="Direct WhatsApp Chat"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Chat on WhatsApp</span>
                  </a>
                ) : null}
              </div>
              <input
                id="edit-poc-number"
                data-testid="edit-poc-number"
                type="text"
                value={pocNumber}
                onChange={(e) => setPocNumber(e.target.value)}
                disabled={isLinkLocked('poc_number')}
                placeholder="+92 300 1234567 or https://wa.me/..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </form>

      {/* 2. Dynamic LinkedIn Lead Generation Profiles Section */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2">
              <LinkedInIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                LinkedIn Lead Generation Profiles
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Track client LinkedIn sender accounts, Sales Navigator subscriptions, and activation timelines.
            </p>
          </div>

          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              readiness.isComplete 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
            }`}>
              {readiness.statusText}
            </span>
          </div>
        </div>

        {/* List of Existing Active Profiles */}
        <div className="space-y-3">
          {profiles.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-gray-200 dark:border-dark-border text-center text-xs text-gray-400">
              No active LinkedIn profiles added yet for this client workspace.
            </div>
          ) : (
            profiles.map((p, idx) => (
              <div 
                key={p.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-200/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {p.profileLabel || `Profile #${idx + 1}`}
                    </span>
                    <a
                      href={p.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 p-0.5"
                      title="Open Profile URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleArchiveProfile(p.id)}
                    className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors text-xs flex items-center gap-1"
                    title="Archive Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={p.profileLabel}
                      onChange={(e) => handleUpdateProfile(p.id, { profileLabel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={p.profileUrl}
                      onChange={(e) => handleUpdateProfile(p.id, { profileUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sales Navigator Active & Date */}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border/60 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.salesNavigatorActive}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleUpdateProfile(p.id, {
                          salesNavigatorActive: checked,
                          salesNavigatorActivatedOn: checked ? (p.salesNavigatorActivatedOn || new Date().toISOString().split('T')[0]) : null
                        });
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Sales Navigator Active
                    </span>
                  </label>

                  {p.salesNavigatorActive && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <span className="text-[11px] font-medium text-gray-500">Activated On:</span>
                      <input
                        type="date"
                        value={p.salesNavigatorActivatedOn || ''}
                        onChange={(e) => handleUpdateProfile(p.id, { salesNavigatorActivatedOn: e.target.value })}
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* LinkedIn Verified */}
                <div className="pt-2 flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.linkedinVerified || false}
                      onChange={(e) => handleUpdateProfile(p.id, { linkedinVerified: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      LinkedIn Verified
                    </span>
                  </label>
                </div>

                {/* Gmail Account */}
                <div className="pt-2 border-t border-gray-100 dark:border-dark-border/60 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.hasGmailAccount || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleUpdateProfile(p.id, {
                          hasGmailAccount: checked,
                          gmailAddress: checked ? (p.gmailAddress || '') : null
                        });
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Gmail Account
                    </span>
                  </label>

                  {p.hasGmailAccount && (
                    <div className="flex items-center gap-2 flex-1 min-w-[200px] animate-fade-in">
                      <span className="text-[11px] font-medium text-gray-500">Gmail Address:</span>
                      <input
                        type="email"
                        value={p.gmailAddress || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProfiles(profiles.map(pr => pr.id === p.id ? { ...pr, gmailAddress: val } : pr));
                        }}
                        onBlur={(e) => handleUpdateProfile(p.id, { gmailAddress: e.target.value })}
                        placeholder="e.g. client.leadgen@gmail.com"
                        className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add New Profile Drawer */}
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Add Additional LinkedIn Profile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profile Label
              </label>
              <input
                type="text"
                value={newProfileLabel}
                onChange={(e) => setNewProfileLabel(e.target.value)}
                placeholder={`e.g. LinkedIn ID ${profiles.length + 1} or Sales Director`}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={newProfileUrl}
                onChange={(e) => setNewProfileUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Sales Navigator Active & Date */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newSalesNavActive}
                onChange={(e) => {
                  setNewSalesNavActive(e.target.checked);
                  if (e.target.checked && !newSalesNavDate) {
                    setNewSalesNavDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Sales Navigator Active
              </span>
            </label>

            {newSalesNavActive && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-gray-500">Activated On:</span>
                <input
                  type="date"
                  value={newSalesNavDate}
                  onChange={(e) => setNewSalesNavDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* LinkedIn Verified */}
          <div className="pt-1 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newLinkedinVerified}
                onChange={(e) => setNewLinkedinVerified(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                LinkedIn Verified
              </span>
            </label>
          </div>

          {/* Gmail Account & Add Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-blue-500/20">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newHasGmailAccount}
                  onChange={(e) => setNewHasGmailAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Gmail Account
                </span>
              </label>

              {newHasGmailAccount && (
                <div className="flex items-center gap-2 flex-1 min-w-[200px] animate-fade-in">
                  <span className="text-[11px] font-medium text-gray-500">Gmail Address:</span>
                  <input
                    type="email"
                    value={newGmailAddress}
                    onChange={(e) => setNewGmailAddress(e.target.value)}
                    placeholder="e.g. client.leadgen@gmail.com"
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddNewProfile}
              disabled={isAddingProfile}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isAddingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Archive Client Danger Zone (Owner & Operational Manager Only) */}
      {isManagerOrOwner && client.status !== 'Archived' && (
        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <Archive className="w-4 h-4" />
              <span>Archive Client Workspace</span>
            </h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/70 max-w-xl">
              Soft-archive this client. All historical tasks, access history, and links will be preserved, and the workspace can be safely restored from Settings → Archive Center.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setArchiveReason('');
              setArchiveError(null);
              setShowArchiveModal(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex-shrink-0 flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archive Client</span>
          </button>
        </div>
      )}

      {/* Archive Client Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <Archive className="w-4 h-4" />
                <span>Confirm Archive Client</span>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              You are archiving <strong className="text-gray-900 dark:text-gray-100">{client.companyName}</strong>. This client will be hidden from the active switcher and task creation will be suspended.
            </p>

            {archiveError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{archiveError}</span>
              </div>
            )}

            <div>
              <label htmlFor="modal-archive-reason" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Mandatory Archive Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="modal-archive-reason"
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Contract ended, client churned, or service paused indefinitely..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-100 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-dark-border">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                disabled={isArchiving}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveClient}
                disabled={isArchiving || !archiveReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {isArchiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                <span>Confirm Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Changes Confirmation Modal */}
      {showDiscardModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-modal-title"
        >
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <h3 id="discard-modal-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Discard Unsaved Changes?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Are you sure you want to discard your unsaved modifications? All changes made to this client workspace draft will be permanently reverted to the last saved state.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
