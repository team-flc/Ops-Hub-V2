const fs = require('fs');

// =========================================================================
// 1. Update ClientWeekStepper.tsx
// =========================================================================
const stepperPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/clients/ClientWeekStepper.tsx';
let stepperCode = fs.readFileSync(stepperPath, 'utf8');

// Add isLoading to interface
stepperCode = stepperCode.replace(
  'isClientView?: boolean;',
  'isClientView?: boolean;\n  isLoading?: boolean;'
);

// Destructure isLoading
stepperCode = stepperCode.replace(
  'isClientView = false\n}) => {',
  'isClientView = false,\n  isLoading = false\n}) => {'
);

// Replace task count & progress pill with loading skeleton support
const oldPill = `{/* Progress & Task Count Pill */}
              <div 
                onClick={() => onSelectWeek(weekNum)}
                className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-dark-border/60 cursor-pointer"
              >
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {doneTasks}/{totalTasks} ({percent}%)
                </span>
              </div>

              {/* Mini progress bar (Thicker & Teal) */}
              <div 
                onClick={() => onSelectWeek(weekNum)}
                className="w-full bg-slate-100 dark:bg-dark-100 h-2 rounded-full overflow-hidden cursor-pointer"
              >
                <div
                  className={\`h-full rounded-full transition-all duration-300 \${
                    percent === 100 ? 'bg-emerald-500' : 'bg-[#0D9488]'
                  }\`}
                  style={{ width: \`\${percent}%\` }}
                />
              </div>`;

const newPill = `{/* Progress & Task Count Pill */}
              {isLoading ? (
                <div 
                  data-testid={\`week-step-loading-\${weekNum}\`}
                  className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-dark-border/60"
                >
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    <span className="h-2.5 w-14 bg-slate-200 dark:bg-dark-100 rounded animate-pulse inline-block" />
                  </span>
                  <span className="h-2.5 w-10 bg-slate-200 dark:bg-dark-100 rounded animate-pulse inline-block" />
                </div>
              ) : (
                <div 
                  onClick={() => onSelectWeek(weekNum)}
                  className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-dark-border/60 cursor-pointer"
                >
                  <span className="font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {doneTasks}/{totalTasks} ({percent}%)
                  </span>
                </div>
              )}

              {/* Mini progress bar (Thicker & Teal) */}
              <div 
                onClick={() => onSelectWeek(weekNum)}
                className="w-full bg-slate-100 dark:bg-dark-100 h-2 rounded-full overflow-hidden cursor-pointer"
              >
                {isLoading ? (
                  <div className="h-full bg-slate-200 dark:bg-dark-200 animate-pulse w-full rounded-full" />
                ) : (
                  <div
                    className={\`h-full rounded-full transition-all duration-300 \${
                      percent === 100 ? 'bg-emerald-500' : 'bg-[#0D9488]'
                    }\`}
                    style={{ width: \`\${percent}%\` }}
                  />
                )}
              </div>`;

stepperCode = stepperCode.replace(oldPill, newPill);
fs.writeFileSync(stepperPath, stepperCode);
console.log('Updated ClientWeekStepper.tsx');

// =========================================================================
// 2. Update ClientKanbanBoard.tsx
// =========================================================================
const kanbanPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/tasks/ClientKanbanBoard.tsx';
let kanbanCode = fs.readFileSync(kanbanPath, 'utf8');

// Add isLoading to interface
kanbanCode = kanbanCode.replace(
  'onShowToast: (msg: string) => void;\n}',
  'onShowToast: (msg: string) => void;\n  isLoading?: boolean;\n}'
);

// Destructure isLoading
kanbanCode = kanbanCode.replace(
  'onShowToast\n}) => {',
  'onShowToast,\n  isLoading = false\n}) => {'
);

// Update column count badge
const oldBadge = `<span className={\`text-xs font-mono font-black px-2 py-0.5 rounded-full \${col.badgeBg} shadow-2xs\`}>
                    {colTasks.length}
                  </span>`;

const newBadge = `{isLoading ? (
                    <span className="w-5 h-4 rounded-full bg-slate-200 dark:bg-dark-200 animate-pulse inline-block" />
                  ) : (
                    <span className={\`text-xs font-mono font-black px-2 py-0.5 rounded-full \${col.badgeBg} shadow-2xs\`}>
                      {colTasks.length}
                    </span>
                  )}`;

kanbanCode = kanbanCode.replace(oldBadge, newBadge);

// Update task cards list to render skeletons when isLoading is true
const oldTaskList = `{/* Task Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1">
                {colTasks.length > 0 ? (`;

const newTaskList = `{/* Task Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1">
                {isLoading ? (
                  <div className="space-y-2.5 p-1">
                    <div className="h-20 bg-slate-100 dark:bg-dark-200/60 rounded-xl animate-pulse" />
                    <div className="h-20 bg-slate-100 dark:bg-dark-200/60 rounded-xl animate-pulse" />
                  </div>
                ) : colTasks.length > 0 ? (`;

kanbanCode = kanbanCode.replace(oldTaskList, newTaskList);
fs.writeFileSync(kanbanPath, kanbanCode);
console.log('Updated ClientKanbanBoard.tsx');

// =========================================================================
// 3. Update ClientWorkspaceView.tsx
// =========================================================================
const workspacePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/clients/ClientWorkspaceView.tsx';
let wsCode = fs.readFileSync(workspacePath, 'utf8');

// Start isLoadingTasks as true so first paint is never 0/0
wsCode = wsCode.replace(
  'const [isLoadingTasks, setIsLoadingTasks] = useState(false);',
  'const [isLoadingTasks, setIsLoadingTasks] = useState(true);'
);

// Reset isLoadingTasks to true whenever client or view changes
wsCode = wsCode.replace(
  `useEffect(() => {
    setActiveWeek('week1');
    setAllTasks([]);
    setActiveTab(client.status === 'Archived' ? 'setup' : (isEffectiveClientView ? 'dashboard' : 'setup'));
  }, [client.id, client.status, isEffectiveClientView]);`,
  `useEffect(() => {
    setActiveWeek('week1');
    setIsLoadingTasks(true);
    setActiveTab(client.status === 'Archived' ? 'setup' : (isEffectiveClientView ? 'dashboard' : 'setup'));
  }, [client.id, client.status, isEffectiveClientView]);`
);

// Pass isLoading to ClientWeekStepper in renderSetupView
wsCode = wsCode.replace(
  `isClientView={isEffectiveClientView}
            />`,
  `isClientView={isEffectiveClientView}
              isLoading={isLoadingTasks}
            />`
);

// Pass isLoading to ClientKanbanBoard in renderSetupView
wsCode = wsCode.replace(
  `onShowToast={showToast}
              />`,
  `onShowToast={showToast}
                isLoading={isLoadingTasks}
              />`
);

// Update Header Action Bar in renderSetupView
const oldHeaderActionBar1 = `<div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'}{!isEffectiveClientView && currentWeekInternalCount > 0 ? \` — \${currentWeekClientVisibleCount} Client Visible, \${currentWeekInternalCount} Internal Staff Only\` : ''})
                  </span>
                  {isLoadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                </div>`;

const newHeaderActionBar1 = `{isLoadingTasks ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Week {currentWeekNum}: {weekNames[currentWeekNum]}
                    </span>
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'}{!isEffectiveClientView && currentWeekInternalCount > 0 ? \` — \${currentWeekClientVisibleCount} Client Visible, \${currentWeekInternalCount} Internal Staff Only\` : ''})
                    </span>
                  </div>
                )}`;

wsCode = wsCode.replace(oldHeaderActionBar1, newHeaderActionBar1);

// Pass isLoading to ClientWeekStepper in staff setup tab
wsCode = wsCode.replace(
  `isClientView={false}
                />`,
  `isClientView={false}
                  isLoading={isLoadingTasks}
                />`
);

// Update Header Action Bar in staff setup tab
const oldHeaderActionBar2 = `<div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'}{currentWeekInternalCount > 0 ? \` — \${currentWeekClientVisibleCount} Client Visible, \${currentWeekInternalCount} Internal Staff Only\` : ''})
                    </span>
                    {isLoadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                  </div>`;

const newHeaderActionBar2 = `{isLoadingTasks ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Week {currentWeekNum}: {weekNames[currentWeekNum]}
                      </span>
                      <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Week {currentWeekNum}: {weekNames[currentWeekNum]} ({currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'Task' : 'Tasks'}{currentWeekInternalCount > 0 ? \` — \${currentWeekClientVisibleCount} Client Visible, \${currentWeekInternalCount} Internal Staff Only\` : ''})
                      </span>
                    </div>
                  )}`;

wsCode = wsCode.replace(oldHeaderActionBar2, newHeaderActionBar2);

// Pass isLoading to ClientKanbanBoard in staff setup tab
wsCode = wsCode.replace(
  `onShowToast={showToast}
                />`,
  `onShowToast={showToast}
                  isLoading={isLoadingTasks}
                />`
);

// Pass isLoading to FinfixClientPortalView
wsCode = wsCode.replace(
  `canViewDetailsTab={!isEffectiveClientView}`,
  `canViewDetailsTab={!isEffectiveClientView}\n        isLoading={isLoadingTasks}`
);

fs.writeFileSync(workspacePath, wsCode);
console.log('Updated ClientWorkspaceView.tsx');
