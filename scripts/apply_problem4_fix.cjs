const fs = require('fs');

const sidebarPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/layout/Sidebar.tsx';
let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

// Ensure ArrowDown is imported from lucide-react
if (!sidebarCode.includes('ArrowDown')) {
  sidebarCode = sidebarCode.replace(
    "import {\n  ChevronsLeft,",
    "import {\n  ArrowDown,\n  ChevronsLeft,"
  );
  if (!sidebarCode.includes('ArrowDown')) {
    sidebarCode = sidebarCode.replace(
      "import {",
      "import { ArrowDown,"
    );
  }
}

// Add WORKSPACE_CATEGORIES definition before Sidebar component
const categoriesDefinition = `
const WORKSPACE_CATEGORIES = [
  { id: 'core', label: 'Core & Docs', keys: ['website', 'flc_landing_page', 'brand_identity', 'google_drive', 'important_docs', 'proposal_contract', 'master_business_doc'] },
  { id: 'media', label: 'Creatives & Media', keys: ['static_creatives', 'videos', 'variations', 'grid', 'vsl', 'testimonials', 'reviews', 'case_studies'] },
  { id: 'ops', label: 'Marketing & Ops', keys: ['requirement_docs', 'gohighlevel', 'social_media_management', 'linkedin_management', 'seo_management', 'email_marketing_management', 'paid_ads_management'] },
  { id: 'social', label: 'Social Channels', keys: ['linkedin_company_page', 'facebook', 'instagram'] },
  { id: 'contact', label: 'Communication & POC', keys: ['slack_channel', 'whatsapp_group', 'poc_number', 'poc_email'] }
];
`;

if (!sidebarCode.includes('WORKSPACE_CATEGORIES')) {
  sidebarCode = sidebarCode.replace(
    'export const Sidebar: React.FC = () => {',
    `${categoriesDefinition}\nexport const Sidebar: React.FC = () => {`
  );
}

// Replace the workspace links container with categorized sections, jump pills, and visible scroll cues
const oldLinksBlock = `{/* Client Workspace Links */}
          {selectedClient && (
            <div className="flex-1 p-3 overflow-y-auto min-h-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1 flex items-center justify-between">
                <span>Workspace Links</span>
                <span className="text-[9px] font-mono text-gray-400 font-semibold">{activeWorkspaceLinks.length} active</span>
              </div>
              <div className="space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-dark-100">`;

const newLinksBlock = `{/* Client Workspace Links (Problem 4: 1366x768 Laptop Optimization with Jump Pills & Visible Scrollbar) */}
          {selectedClient && (
            <div className="flex-1 p-3 overflow-y-auto min-h-0 custom-scrollbar scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-dark-100 hover:scrollbar-thumb-teal-500">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5 px-1 flex items-center justify-between">
                <span>Workspace Links</span>
                <span className="text-[9px] font-mono text-teal-600 dark:text-teal-400 font-semibold">{activeWorkspaceLinks.length} active</span>
              </div>

              {/* Quick Jump Category Pills for 768px Laptop Screens */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 no-scrollbar text-[9px] border-b border-gray-100 dark:border-dark-border/60">
                {WORKSPACE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(\`workspace-cat-\${cat.id}\`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 font-semibold transition-colors shrink-0 cursor-pointer"
                  >
                    {cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="space-y-0.5 pr-1">`;

sidebarCode = sidebarCode.replace(oldLinksBlock, newLinksBlock);

// Inside the links map, add category headers
const oldMapHeader = `{displayedWorkspaceLinks.map((link) => {`;
const newMapHeader = `{displayedWorkspaceLinks.map((link, linkIdx) => {
                  // Determine if this link starts a new category
                  const currentCategory = WORKSPACE_CATEGORIES.find((cat) => cat.keys.includes(link.key));
                  const prevLink = linkIdx > 0 ? displayedWorkspaceLinks[linkIdx - 1] : null;
                  const prevCategory = prevLink ? WORKSPACE_CATEGORIES.find((cat) => cat.keys.includes(prevLink.key)) : null;
                  const isNewCategory = currentCategory && (!prevCategory || prevCategory.id !== currentCategory.id);
                  const activeInCategory = currentCategory
                    ? displayedWorkspaceLinks.filter((l) => currentCategory.keys.includes(l.key) && Boolean(l.url && l.url.trim())).length
                    : 0;`;

sidebarCode = sidebarCode.replace(oldMapHeader, newMapHeader);

// In the link return, prepend category header if isNewCategory
const oldHasContentReturn = `if (hasContent) {
                    if ((link as any).isTextAction) {`;

const newHasContentReturn = `const categoryHeaderElement = isNewCategory && currentCategory ? (
                    <div
                      id={\`workspace-cat-\${currentCategory.id}\`}
                      data-testid={\`workspace-cat-\${currentCategory.id}\`}
                      className="pt-2.5 pb-1 px-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-dark-border/40 first:border-0 first:pt-0"
                    >
                      <span>{currentCategory.label}</span>
                      <span className="text-[9px] font-mono font-normal text-slate-400">{activeInCategory} active</span>
                    </div>
                  ) : null;

                  if (hasContent) {
                    if ((link as any).isTextAction) {
                      return (
                        <React.Fragment key={link.key}>
                          {categoryHeaderElement}
                          <button`;

sidebarCode = sidebarCode.replace(oldHasContentReturn, newHasContentReturn);

// Close React.Fragment for text action
sidebarCode = sidebarCode.replace(
  `                          <BookOpen className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    }`,
  `                          <BookOpen className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                        </React.Fragment>
                      );
                    }`
);

// Close React.Fragment for email dialog action
sidebarCode = sidebarCode.replace(
  `return (
                        <button
                          key={link.key}
                          type="button"
                          onClick={() => setIsPocEmailModalOpen(true)}`,
  `return (
                        <React.Fragment key={link.key}>
                          {categoryHeaderElement}
                          <button
                            type="button"
                            onClick={() => setIsPocEmailModalOpen(true)}`
);
sidebarCode = sidebarCode.replace(
  `                          <Mail className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    }
                    return (`,
  `                          <Mail className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                        </React.Fragment>
                      );
                    }
                    return (`
);

// Close React.Fragment for normal anchor
sidebarCode = sidebarCode.replace(
  `return (
                      <a
                        key={link.key}
                        href={link.url}`,
  `return (
                      <React.Fragment key={link.key}>
                        {categoryHeaderElement}
                        <a
                          href={link.url}`
);
sidebarCode = sidebarCode.replace(
  `                        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </a>
                    );
                  }
                  return (`,
  `                        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      </React.Fragment>
                    );
                  }
                  return (`
);

// Close React.Fragment for disabled div
sidebarCode = sidebarCode.replace(
  `return (
                    <div
                      key={link.key}
                      data-testid={\`sidebar-link-\${link.key.replace(/_/g, '-')}-disabled\`}`,
  `return (
                    <React.Fragment key={link.key}>
                      {categoryHeaderElement}
                      <div
                        data-testid={\`sidebar-link-\${link.key.replace(/_/g, '-')}-disabled\`}`
);
sidebarCode = sidebarCode.replace(
  `                        <span className="truncate">{link.label}</span>
                      </div>
                    </div>
                  );
                })}`,
  `                        <span className="truncate">{link.label}</span>
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })}`
);

// Add scroll cue at the end of links
const oldEndLinks = `                })}
              </div>
            </div>
          )}`;

const newEndLinks = `                })}
                {/* Scroll cue indicating communication links below */}
                <div className="pt-2 pb-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('workspace-cat-contact');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="text-[9px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <span>Slack, WhatsApp & POC below</span>
                    <ArrowDown className="w-2.5 h-2.5 animate-bounce" />
                  </button>
                </div>
              </div>
            </div>
          )}`;

sidebarCode = sidebarCode.replace(oldEndLinks, newEndLinks);

fs.writeFileSync(sidebarPath, sidebarCode);
console.log('Updated Sidebar.tsx with Problem 4 fixes');
