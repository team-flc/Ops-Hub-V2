const fs = require('fs');
const filePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/portal/FinfixClientPortalView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add totalVisibleTasks alias
const oldVisibleTasks = `  const totalClientVisibleTasks = clientVisibleTasks.length;`;
const newVisibleTasks = `  const totalClientVisibleTasks = clientVisibleTasks.length;
  const totalVisibleTasks = totalClientVisibleTasks;`;

content = content.replace(oldVisibleTasks, newVisibleTasks);

// 2. Add getTaskEventTimestamp before unifiedRecentActivities
const oldRecent = `  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

const newRecent = `  // Unified task event timestamp helper (Eliminates modal vs card date mismatch)
  const getTaskEventTimestamp = (t: ClientTask): { iso: string; formatted: string } => {
    const isDone = t.status === 'Completed' || t.status === 'Done';
    const raw = isDone && t.completedAt ? t.completedAt : t.createdAt || t.updatedAt || '';
    return {
      iso: raw,
      formatted: raw ? formatPKTDate(raw) : 'Recently'
    };
  };

  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

content = content.replace(oldRecent, newRecent);

// 3. Fix recentActivitiesPreview typing
const oldPreview = `  const recentActivitiesPreview = useMemo(() => {
    return unifiedRecentActivities.slice(0, 4).map((act) => ({
      id: \`act-\${act.id}\`,
      title: act.action,
      subtitle: act.title,
      iconType: act.iconType,
      timestamp: act.timestamp
    }));
  }, [unifiedRecentActivities]);`;

const newPreview = `  const recentActivitiesPreview = useMemo<Array<{
    id: string;
    title: string;
    subtitle: string;
    iconType: 'check' | 'message' | 'dollar' | 'edit';
    timestamp: string;
  }>>(() => {
    return unifiedRecentActivities.slice(0, 4).map((act) => ({
      id: \`act-\${act.id}\`,
      title: act.action,
      subtitle: act.title,
      iconType: act.iconType as 'check' | 'message' | 'dollar' | 'edit',
      timestamp: act.timestamp
    }));
  }, [unifiedRecentActivities]);`;

content = content.replace(oldPreview, newPreview);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed portal errors!');
