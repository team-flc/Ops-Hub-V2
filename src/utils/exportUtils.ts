import { Task, Space } from '../types';

export function exportTasksToCSV(tasks: Task[], spaces: Space[]) {
  const headers = [
    'Task ID',
    'Title',
    'Status',
    'Priority',
    'Space',
    'Due Date',
    'Estimated (Hrs)',
    'Subtasks Done',
    'Total Subtasks',
    'SLA Status',
    'Client',
    'Risk Level',
    'Created At'
  ];

  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));

  const rows = tasks.map((t) => {
    const spaceName = spaceMap.get(t.spaceId) || 'Unknown';
    const doneSubtasks = t.subtasks.filter((st) => st.completed).length;
    const totalSubtasks = t.subtasks.length;
    const sla = t.customFields?.slaStatus || 'within_sla';
    const client = t.customFields?.clientName || '';
    const risk = t.customFields?.riskLevel || 'Low';

    return [
      `"${t.taskNumber}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${spaceName}"`,
      `"${t.dueDate || ''}"`,
      `"${t.estimatedHours || 0}"`,
      `"${doneSubtasks}"`,
      `"${totalSubtasks}"`,
      `"${sla}"`,
      `"${client}"`,
      `"${risk}"`,
      `"${new Date(t.createdAt).toLocaleDateString()}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `OpsHub_Tasks_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
