const fs = require('fs');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add FileText to lucide-react import
  const lucideOld = "LayoutDashboard } from 'lucide-react';";
  const lucideNew = "LayoutDashboard, FileText } from 'lucide-react';";
  if (content.includes(lucideOld)) {
    content = content.replace(lucideOld, lucideNew);
  }

  // 2. Import ClientMonthlyReportsView
  const portalImportOld = "import { FinfixClientPortalView } from '../portal/FinfixClientPortalView';";
  const portalImportNew = "import { FinfixClientPortalView } from '../portal/FinfixClientPortalView';\nimport { ClientMonthlyReportsView } from '../portal/ClientMonthlyReportsView';";
  if (content.includes(portalImportOld)) {
    content = content.replace(portalImportOld, portalImportNew);
  }

  // 3. Update MainTab type
  const mainTabOld = "type MainTab = 'dashboard' | 'setup' | 'workplans' | 'details';";
  const mainTabNew = "type MainTab = 'dashboard' | 'setup' | 'workplans' | 'details' | 'reports';";
  if (content.includes(mainTabOld)) {
    content = content.replace(mainTabOld, mainTabNew);
  }

  // 4. Add staff tab button
  const detailsBtnOld = `<button
                type="button"
                data-testid="tab-details"
                onClick={() => setActiveTab('details')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'details'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Client Details</span>
              </button>`;

  const detailsBtnWithReports = `${detailsBtnOld}

              <button
                type="button"
                data-testid="tab-reports"
                onClick={() => setActiveTab('reports')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'reports'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Monthly Reports</span>
              </button>`;

  // Normalize newlines for matching
  const normContent = content.replace(/\r\n/g, '\n');
  const normOld = detailsBtnOld.replace(/\r\n/g, '\n');
  const normNew = detailsBtnWithReports.replace(/\r\n/g, '\n');

  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew);
  } else {
    console.error('Could not find detailsBtnOld in', filePath);
  }

  // 5. Add staff tab content
  const detailsContentOld = `{activeTab === 'details' && (
              <ClientDetailsTab
                client={client}
                currentUserProfile={currentUserProfile}
                eligibleManagers={eligibleManagers}
                onClientUpdated={onClientUpdated}
              />
            )}`;

  const detailsContentWithReports = `${detailsContentOld}

            {activeTab === 'reports' && (
              <div data-testid="staff-reports-view" className="space-y-6">
                <ClientMonthlyReportsView
                  client={client}
                  tasks={allTasks}
                  isStaffView={true}
                />
              </div>
            )}`;

  const normDetailsContentOld = detailsContentOld.replace(/\r\n/g, '\n');
  const normDetailsContentWithReports = detailsContentWithReports.replace(/\r\n/g, '\n');

  if (content.includes(normDetailsContentOld)) {
    content = content.replace(normDetailsContentOld, normDetailsContentWithReports);
  } else {
    console.error('Could not find detailsContentOld in', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated:', filePath);
}

updateFile('C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/clients/ClientWorkspaceView.tsx');
updateFile('C:/Users/Atif/Documents/Websites Backup/Ops Hub v2/src/components/clients/ClientWorkspaceView.tsx');
