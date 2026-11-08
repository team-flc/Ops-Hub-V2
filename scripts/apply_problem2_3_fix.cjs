const fs = require('fs');

const portalPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/portal/FinfixClientPortalView.tsx';
let portalCode = fs.readFileSync(portalPath, 'utf8');

// 1. Add isLoading to FinfixClientPortalViewProps
portalCode = portalCode.replace(
  'canViewDetailsTab?: boolean;\n}',
  'canViewDetailsTab?: boolean;\n  isLoading?: boolean;\n}'
);

// Destructure isLoading
portalCode = portalCode.replace(
  'canViewDetailsTab = false\n}) => {',
  'canViewDetailsTab = false,\n  isLoading: propIsLoading = false\n}) => {'
);

// 2. Fix Problem 2: Strict Dominant Status Rule
const oldDominantRule = `      let status: 'Completed' | 'In Progress' | 'In Review' | 'Pending' = 'Pending';
      if (total === 0) {
        status = 'Pending';
      } else if (done === total) {
        status = 'Completed';
      } else if (inProgressTasks.length > 0) {
        status = 'In Progress';
      } else if (approvalTasks.length > 0) {
        status = 'In Review';
      } else {
        status = 'Pending';
      }`;

const newDominantRule = `      let status: 'Completed' | 'In Progress' | 'In Review' | 'Pending' = 'Pending';
      if (total === 0) {
        status = 'Pending';
      } else if (done === total) {
        status = 'Completed';
      } else if (approvalTasks.length >= inProgressTasks.length && approvalTasks.length > 0) {
        status = 'In Review';
      } else if (inProgressTasks.length > approvalTasks.length) {
        status = 'In Progress';
      } else {
        status = 'Pending';
      }`;

portalCode = portalCode.replace(oldDominantRule, newDominantRule);

// 3. Fix Problem 3: Footer Ambiguity (Use totalAllTasks and include reconciliation in brackets)
const oldFooterStatus = `  // Real Progress Status Line (Fix 2: Eliminates demo text)
  const realProgressStatusLine = useMemo(() => {
    if (totalVisibleTasks === 0 || completedTasks.length === 0) {
      return null;
    }
    if (completedThisWeek > 0) {
      return \`\${completionPercent}% completed · +\${completedThisWeek} completed this week\`;
    }
    return \`\${completionPercent}% completed · \${completedTasks.length} of \${totalVisibleTasks} deliverables completed\`;
  }, [totalVisibleTasks, completedTasks.length, completedThisWeek, completionPercent]);`;

const newFooterStatus = `  // Real Progress Status Line (Fix 2 & Problem 3 Fix: Exact total and reconciliation in brackets)
  const realProgressStatusLine = useMemo(() => {
    if (totalAllTasks === 0) {
      return '0% completed · No active deliverables on file';
    }
    const reconSnippet = totalInternalTasks > 0
      ? \` (\${totalClientVisibleTasks} visible + \${totalInternalTasks} internal)\`
      : '';
    return \`\${completionPercent}% completed · \${completedTasks.length} of \${totalAllTasks} deliverables completed\${reconSnippet}\`;
  }, [totalAllTasks, completedTasks.length, totalInternalTasks, totalClientVisibleTasks, completionPercent]);`;

portalCode = portalCode.replace(oldFooterStatus, newFooterStatus);

fs.writeFileSync(portalPath, portalCode);
console.log('Updated FinfixClientPortalView.tsx with Problem 2 & 3 fixes');
