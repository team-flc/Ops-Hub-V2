const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'src', 'components', 'portal', 'FinfixClientPortalView.tsx'),
  path.join('C:\\Users\\Atif\\Documents\\Websites Backup\\Ops Hub v2', 'src', 'components', 'portal', 'FinfixClientPortalView.tsx')
];

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) {
    console.log('Skipping non-existent:', filePath);
    continue;
  }
  let c = fs.readFileSync(filePath, 'utf8');

  // 1. Add storageService import
  if (!c.includes('useSignedUrl')) {
    c = c.replace(
      "import { taskManagementService } from '../../lib/taskManagementService';",
      "import { useSignedUrl } from '../../lib/storageService';\nimport { taskManagementService } from '../../lib/taskManagementService';"
    );
  }

  // 2. Add clientDisplayLogoUrl
  if (!c.includes('clientDisplayLogoUrl')) {
    c = c.replace(
      "const clientGreetingName = client.companyName || client.clientName || 'Partner';",
      "const rawLogo = client.logoUrl || (client as any).logo_url;\n  const clientDisplayLogoUrl = useSignedUrl('client-logos', rawLogo);\n  const clientGreetingName = client.companyName || client.clientName || 'Partner';"
    );
  }

  // 3. Sidebar Header: Red FASEEH LALL AND CO. logo + client secondary logo / initials avatar
  const oldSidebarHeader = `<div className="p-5 border-b border-slate-800/80 dark:border-dark-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-black shadow-inner">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold text-white truncate leading-tight tracking-tight">
                {client.companyName || client.clientName}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400/90 block truncate">
                Client Workspace
              </span>
            </div>
          </div>`;

  const newSidebarHeader = `<div className="p-4 border-b border-slate-800/80 dark:border-dark-border space-y-2.5">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="FASEEH LALL & CO."
                className="h-7 w-auto object-contain"
                data-testid="faseeh-lall-brand-logo"
              />
            </div>
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/70">
              {clientDisplayLogoUrl ? (
                <img
                  src={clientDisplayLogoUrl}
                  alt={client.companyName || client.clientName}
                  data-testid="client-secondary-logo"
                  className="w-8 h-8 rounded-lg object-contain border border-slate-700/80 p-0.5 bg-white shrink-0 shadow-xs"
                />
              ) : (
                <div
                  data-testid="client-initials-avatar"
                  className="w-8 h-8 rounded-lg bg-brand-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                >
                  {clientInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-extrabold text-white truncate leading-tight tracking-tight">
                  {client.companyName || client.clientName}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400 block truncate">
                  Client Workspace
                </span>
              </div>
            </div>
          </div>`;

  if (c.includes(oldSidebarHeader)) {
    c = c.replace(oldSidebarHeader, newSidebarHeader);
  } else {
    console.warn('oldSidebarHeader not matched exactly, checking partial replace');
  }

  // 4. Active sidebar navigation item
  c = c.replace(
    "bg-[#0D9488] text-white font-bold shadow-md shadow-teal-900/30",
    "bg-brand-500 text-white font-bold shadow-md shadow-brand-900/40"
  );

  // 5. Notifications panel bell & badge
  c = c.replace(
    '<Bell className="w-4 h-4 text-teal-600" />',
    '<Bell className="w-4 h-4 text-brand-600" />'
  );
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
  );

  // 6. Header Client User Avatar / Logo
  const oldHeaderAvatar = `<div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-dark-border">
              <div className="w-9 h-9 rounded-full bg-[#0D9488] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {clientInitials}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">
                {clientContactName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>`;

  const newHeaderAvatar = `<div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-dark-border">
              {clientDisplayLogoUrl ? (
                <img
                  src={clientDisplayLogoUrl}
                  alt={client.companyName || client.clientName}
                  data-testid="header-client-logo"
                  className="w-9 h-9 rounded-full object-contain border border-slate-200 dark:border-dark-border p-0.5 bg-white shadow-xs"
                />
              ) : (
                <div
                  data-testid="header-client-avatar"
                  className="w-9 h-9 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shadow-xs"
                >
                  {clientInitials}
                </div>
              )}
              <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">
                {clientContactName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>`;

  if (c.includes(oldHeaderAvatar)) {
    c = c.replace(oldHeaderAvatar, newHeaderAvatar);
  }

  // 7. Workspace Main Tabs
  c = c.replace(
    "activeMainTab === 'dashboard'\n                      ? 'bg-[#0D9488] text-white shadow-xs'",
    "activeMainTab === 'dashboard'\n                      ? 'bg-brand-500 text-white shadow-xs'"
  );
  c = c.replace(
    "activeMainTab === 'setup'\n                    ? 'bg-[#0D9488] text-white shadow-xs'",
    "activeMainTab === 'setup'\n                    ? 'bg-brand-500 text-white shadow-xs'"
  );
  c = c.replace(
    "activeMainTab === 'workplans'\n                    ? 'bg-[#0D9488] text-white shadow-xs'",
    "activeMainTab === 'workplans'\n                    ? 'bg-brand-500 text-white shadow-xs'"
  );
  c = c.replace(
    "activeMainTab === 'details'\n                      ? 'bg-[#0D9488] text-white shadow-xs'",
    "activeMainTab === 'details'\n                      ? 'bg-brand-500 text-white shadow-xs'"
  );

  // 8. Active Workspace Banner Icon
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-xs',
    'bg-brand-50 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/40 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 shadow-xs'
  );

  // 9. Stat Card 1 (Project Completion)
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center shrink-0',
    'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800/40 flex items-center justify-center shrink-0'
  );

  // 10. Performance Overview
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-200/60 dark:border-teal-800/40',
    'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200/60 dark:border-brand-800/40'
  );
  c = c.replace(
    "? 'bg-[#0D9488] text-white shadow-xs font-extrabold cursor-pointer'",
    "? 'bg-brand-500 text-white shadow-xs font-extrabold cursor-pointer'"
  );
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center',
    'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center'
  );
  c = c.replace(
    'bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800',
    'bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800'
  );

  // 11. Project Progress
  c = c.replace(
    'className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"',
    'className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors cursor-pointer"'
  );

  // Project Progress rows: replace the old color array and bar styles
  c = c.replace(
    "{ bar: 'bg-[#0D9488]', pill: 'bg-[#0D9488] text-white' },",
    "{ bar: 'bg-brand-500', pill: 'bg-blue-600 text-white' },"
  );

  // Ensure progress bar uses red for work done
  c = c.replace(
    "proj.status === 'Completed'\n                                  ? 'bg-emerald-600'\n                                  : proj.status === 'In Progress'\n                                  ? color.bar\n                                  : proj.status === 'In Review'\n                                  ? 'bg-purple-600'\n                                  : 'bg-amber-500'",
    "proj.status === 'Completed'\n                                  ? 'bg-emerald-600'\n                                  : proj.percent > 0\n                                  ? 'bg-brand-500'\n                                  : 'bg-slate-300 dark:bg-dark-border'"
  );

  // 12. Subscription & Billing
  c = c.replace(
    'bg-[#E8F6F3] dark:bg-teal-950/20 border border-teal-200/90 dark:border-teal-800/40 space-y-3 shadow-xs',
    'bg-slate-50 dark:bg-dark-300/40 border border-slate-200/90 dark:border-dark-border space-y-3 shadow-xs'
  );
  c = c.replace(
    'border-t border-teal-200/70 dark:border-teal-800/40 flex items-center justify-between text-xs',
    'border-t border-slate-200/70 dark:border-dark-border/60 flex items-center justify-between text-xs'
  );
  c = c.replace(
    '<Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />',
    '<Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />'
  );
  c = c.replace(
    '<CreditCard className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />',
    '<CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />'
  );
  c = c.replace(
    '<Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />',
    '<Receipt className="w-4 h-4 text-brand-600 dark:text-brand-400" />'
  );

  // 13. Recent Activity "View All" link
  c = c.replace(
    'className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"',
    'className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors cursor-pointer"'
  );

  // 14. Bottom Bar: Icon & Download Monthly Report Button
  c = c.replace(
    '<Sparkles className="w-5 h-5 text-teal-500" />',
    '<Sparkles className="w-5 h-5 text-brand-500" />'
  );
  c = c.replace(
    'bg-[#0D9488] hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer shrink-0 ml-auto sm:ml-0',
    'bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer shrink-0 ml-auto sm:ml-0'
  );

  // 15. Other Views & Modals (Projects, Approvals, Team, Analytics, Website & SEO, Subscription, Settings, Search)
  c = c.replace(
    "bg-teal-50/50 dark:bg-teal-950/20 border-teal-500/50 text-teal-950 dark:text-teal-200 shadow-xs",
    "bg-brand-50/50 dark:bg-brand-950/20 border-brand-500/50 text-brand-950 dark:text-brand-200 shadow-xs"
  );
  c = c.replace(
    "t.status === 'In Progress'\n                                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'",
    "t.status === 'In Progress'\n                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'"
  );
  c = c.replace(
    'className="text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-bold"',
    'className="text-[11px] text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 font-bold"'
  );
  c = c.replace(
    'className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"',
    'className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"'
  );
  c = c.replace(
    'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-teal-600 dark:text-teal-400',
    'bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex items-center justify-center font-bold text-brand-600 dark:text-brand-400'
  );
  c = c.replace(
    'bg-[#0D9488] hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer',
    'bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer'
  );
  c = c.replace(
    'className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"',
    'className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"'
  );
  c = c.replace(
    'bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer',
    'bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer'
  );
  c = c.replace(
    'text-teal-600 dark:text-teal-400 hover:bg-slate-100 transition-colors cursor-pointer',
    'text-brand-600 dark:text-brand-400 hover:bg-slate-100 transition-colors cursor-pointer'
  );
  c = c.replace(
    "item.status === 'In Progress'\n                                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'",
    "item.status === 'In Progress'\n                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'"
  );
  c = c.replace(
    'group-hover:text-teal-600 dark:group-hover:text-teal-400',
    'group-hover:text-brand-600 dark:group-hover:text-brand-400'
  );
  c = c.replace(
    'text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1 font-bold',
    'text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 font-bold'
  );
  c = c.replace(
    'text-xs text-slate-400 group-hover:text-teal-600 font-bold transition-colors',
    'text-xs text-slate-400 group-hover:text-brand-600 font-bold transition-colors'
  );
  c = c.replace(
    'text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center justify-end gap-1 mt-1 font-bold',
    'text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center justify-end gap-1 mt-1 font-bold'
  );

  fs.writeFileSync(filePath, c, 'utf8');
  console.log('Successfully updated:', filePath);
}
