const fs = require('fs');
const files = [
  'C:\\Users\\Atif\\Documents\\GitHub\\Ops-Hub-V2\\src\\components\\clients\\ClientWorkspaceView.tsx',
  'C:\\Users\\Atif\\Documents\\Websites Backup\\Ops Hub v2\\src\\components\\clients\\ClientWorkspaceView.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  // 1. activeTab initial state & reset
  content = content.replace(
    "const [activeTab, setActiveTab] = useState<MainTab>('setup');",
    "const [activeTab, setActiveTab] = useState<MainTab>(isEffectiveClientView ? 'details' : 'setup');"
  );
  content = content.replace(
    "setActiveTab('setup');",
    "setActiveTab(isEffectiveClientView ? 'details' : 'setup');"
  );

  // 2. Tab order: details, setup, workplans, reports (staff only)
  const oldTabs = `            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="tab-setup"
                onClick={() => setActiveTab('setup')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'setup' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>30-Day Setup</span>
              </button>

              <button
                type="button"
                data-testid="tab-workplans"
                onClick={() => setActiveTab('workplans')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'workplans' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>90-Day Work Plans</span>
              </button>

              <button
                type="button"
                data-testid="tab-details"
                onClick={() => setActiveTab('details')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'details' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Client Details</span>
              </button>

              <button
                type="button"
                data-testid="tab-reports"
                onClick={() => setActiveTab('reports')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'reports' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Monthly Reports</span>
              </button>
            </div>`;

  const newTabs = `            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="tab-details"
                onClick={() => setActiveTab('details')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'details' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Client Details</span>
              </button>

              <button
                type="button"
                data-testid="tab-setup"
                onClick={() => setActiveTab('setup')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'setup' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>30-Day Setup</span>
              </button>

              <button
                type="button"
                data-testid="tab-workplans"
                onClick={() => setActiveTab('workplans')}
                className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                  activeTab === 'workplans' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                }\`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>90-Day Work Plans</span>
              </button>

              {!isEffectiveClientView && (
                <button
                  type="button"
                  data-testid="tab-reports"
                  onClick={() => setActiveTab('reports')}
                  className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer \${
                    activeTab === 'reports' ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-200'
                  }\`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Monthly Reports</span>
                </button>
              )}
            </div>`;

  const crlfOldTabs = oldTabs.replace(/\n/g, '\r\n');
  const crlfNewTabs = newTabs.replace(/\n/g, '\r\n');

  if (content.includes(oldTabs)) {
    content = content.replace(oldTabs, newTabs);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Replaced LF in ' + f);
  } else if (content.includes(crlfOldTabs)) {
    content = content.replace(crlfOldTabs, crlfNewTabs);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Replaced CRLF in ' + f);
  } else {
    console.log('Could not find old tabs in ' + f);
  }
});
