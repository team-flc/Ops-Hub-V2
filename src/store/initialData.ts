import { Space, User, Task, SOPDocument, AutomationRule, ClientVendor } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Atif Khan',
    email: 'atif.khan@opshub.internal',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Ops Director',
    department: 'Executive Operations',
    status: 'online',
    initials: 'AK'
  },
  {
    id: 'user-2',
    name: 'Sarah Jenkins',
    email: 'sarah.j@opshub.internal',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'Operations Lead',
    department: 'Logistics & Supply',
    status: 'busy',
    initials: 'SJ'
  },
  {
    id: 'user-3',
    name: 'Bilal Ahmed',
    email: 'bilal.a@opshub.internal',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'Support Lead',
    department: 'Customer SLA & Support',
    status: 'online',
    initials: 'BA'
  },
  {
    id: 'user-4',
    name: 'Elena Rostova',
    email: 'elena.r@opshub.internal',
    role: 'Ops Specialist',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    department: 'Process Quality & QA',
    status: 'away',
    initials: 'ER'
  },
  {
    id: 'user-5',
    name: 'Marcus Vance',
    email: 'marcus.v@opshub.internal',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'Logistics Coordinator',
    department: 'Field Logistics',
    status: 'online',
    initials: 'MV'
  }
];

export const INITIAL_SPACES: Space[] = [
  {
    id: 'space-1',
    name: 'Daily Operations & Shifts',
    icon: 'Activity',
    color: '#6366f1',
    description: 'Core daily operational processes, shift handovers, and routine site checks.',
    statuses: [
      { id: 'todo', label: 'To Do', color: '#94a3b8', category: 'todo' },
      { id: 'in_progress', label: 'In Progress', color: '#3b82f6', category: 'inprogress' },
      { id: 'under_review', label: 'Under Review', color: '#8b5cf6', category: 'inprogress' },
      { id: 'blocked', label: 'Blocked / Escalated', color: '#ef4444', category: 'blocked' },
      { id: 'completed', label: 'Completed', color: '#10b981', category: 'done' }
    ],
    folders: [
      {
        id: 'folder-1-1',
        spaceId: 'space-1',
        name: 'Shift Handover & Audits',
        lists: [
          { id: 'list-1-1-1', spaceId: 'space-1', folderId: 'folder-1-1', name: 'Shift Handover Checklist', color: '#6366f1' },
          { id: 'list-1-1-2', spaceId: 'space-1', folderId: 'folder-1-1', name: 'Daily Facility Walkthrough', color: '#8b5cf6' }
        ]
      }
    ],
    lists: [
      { id: 'list-1-loose-1', spaceId: 'space-1', name: 'General Ops Queue', color: '#3b82f6' },
      { id: 'list-1-loose-2', spaceId: 'space-1', name: 'Equipment Maintenance', color: '#06b6d4' }
    ]
  },
  {
    id: 'space-2',
    name: 'Supply Chain & Logistics',
    icon: 'Truck',
    color: '#06b6d4',
    description: 'Fleet coordination, inventory fulfillment, dispatches, and customs clearance.',
    statuses: [
      { id: 'todo', label: 'Order Queued', color: '#94a3b8', category: 'todo' },
      { id: 'in_progress', label: 'In Transit / Picking', color: '#06b6d4', category: 'inprogress' },
      { id: 'under_review', label: 'Customs / QA Check', color: '#eab308', category: 'inprogress' },
      { id: 'blocked', label: 'Delivery Exception', color: '#ef4444', category: 'blocked' },
      { id: 'completed', label: 'Delivered & Signed', color: '#10b981', category: 'done' }
    ],
    folders: [
      {
        id: 'folder-2-1',
        spaceId: 'space-2',
        name: 'Freight & Fleet Management',
        lists: [
          { id: 'list-2-1-1', spaceId: 'space-2', folderId: 'folder-2-1', name: 'Priority Express Dispatches', color: '#06b6d4' },
          { id: 'list-2-1-2', spaceId: 'space-2', folderId: 'folder-2-1', name: 'Fleet Vehicle Inspections', color: '#38bdf8' }
        ]
      }
    ],
    lists: [
      { id: 'list-2-loose-1', spaceId: 'space-2', name: 'Warehouse Stock Audits', color: '#14b8a6' }
    ]
  },
  {
    id: 'space-3',
    name: 'Customer SLA & Support Ops',
    icon: 'Headphones',
    color: '#f59e0b',
    description: 'Tier 2/3 operational escalations, SLA breach prevention, and VIP client ops.',
    statuses: [
      { id: 'todo', label: 'Open Ticket', color: '#94a3b8', category: 'todo' },
      { id: 'in_progress', label: 'Investigating', color: '#f59e0b', category: 'inprogress' },
      { id: 'under_review', label: 'Pending Client Confirmation', color: '#6366f1', category: 'inprogress' },
      { id: 'blocked', label: 'SLA Escalated', color: '#ef4444', category: 'blocked' },
      { id: 'completed', label: 'Resolved & Closed', color: '#10b981', category: 'done' }
    ],
    folders: [],
    lists: [
      { id: 'list-3-1', spaceId: 'space-3', name: 'Tier 2 Operational Escalations', color: '#f59e0b' },
      { id: 'list-3-2', spaceId: 'space-3', name: 'Enterprise Client Onboarding', color: '#ec4899' }
    ]
  },
  {
    id: 'space-4',
    name: 'IT & Infrastructure Ops',
    icon: 'Cpu',
    color: '#10b981',
    description: 'Cloud server health, database backups, security compliance, and network uptime.',
    statuses: [
      { id: 'todo', label: 'Backlog', color: '#94a3b8', category: 'todo' },
      { id: 'in_progress', label: 'In Execution', color: '#10b981', category: 'inprogress' },
      { id: 'under_review', label: 'Peer Review / Testing', color: '#a855f7', category: 'inprogress' },
      { id: 'blocked', label: 'Outage / Blocked', color: '#ef4444', category: 'blocked' },
      { id: 'completed', label: 'Deployed / Passed', color: '#059669', category: 'done' }
    ],
    folders: [],
    lists: [
      { id: 'list-4-1', spaceId: 'space-4', name: 'Monthly Infrastructure Maintenance', color: '#10b981' },
      { id: 'list-4-2', spaceId: 'space-4', name: 'Security & Backup Verification', color: '#14b8a6' }
    ]
  }
];

const now = new Date();
const todayStr = now.toISOString().split('T')[0];
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-101',
    taskNumber: 'OPS-101',
    title: 'Conduct Morning Shift Handover & System Status Verification',
    description: 'Review night shift logs, check operational incident tickets, confirm warehouse staffing levels, and review high-priority delivery queues.',
    status: 'in_progress',
    priority: 'urgent',
    spaceId: 'space-1',
    folderId: 'folder-1-1',
    listId: 'list-1-1-1',
    assigneeIds: ['user-1', 'user-2'],
    dueDate: todayStr,
    startDate: todayStr,
    estimatedHours: 2.5,
    subtasks: [
      { id: 'st-1', title: 'Verify automated ERP database sync status', completed: true },
      { id: 'st-2', title: 'Check night shift incident tickets in Zendesk', completed: true },
      { id: 'st-3', title: 'Confirm logistics crew clock-in attendance (min 8 members)', completed: false, assigneeId: 'user-2' },
      { id: 'st-4', title: 'Send morning ops summary broadcast on Slack', completed: false }
    ],
    tags: ['Daily Routine', 'Shift Handover', 'SOP-002'],
    customFields: {
      slaStatus: 'within_sla',
      department: 'Operations & Dispatch',
      riskLevel: 'Medium',
      budget: 0
    },
    timeLogs: [
      {
        id: 'tl-1',
        userId: 'user-1',
        userName: 'Atif Khan',
        durationMinutes: 45,
        description: 'Completed ERP database check and reviewed night logs.',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        billable: false
      }
    ],
    comments: [
      {
        id: 'c-1',
        userId: 'user-2',
        userName: 'Sarah Jenkins',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        content: 'All warehouse staff checked in on time. Forklift #3 is undergoing routine battery swap.',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ],
    activityLogs: [
      {
        id: 'act-1',
        userId: 'user-1',
        userName: 'Atif Khan',
        action: 'Created task and set priority to Urgent',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        type: 'priority'
      },
      {
        id: 'act-2',
        userId: 'user-1',
        userName: 'Atif Khan',
        action: 'Logged 45 minutes of work',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'time'
      }
    ],
    order: 1,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-102',
    taskNumber: 'OPS-102',
    title: 'Audit Cold-Chain Temperature Sensors in Warehouse Zone B',
    description: 'Ensure humidity and temperature sensors are calibrated within the mandated -18C to -22C range for perishable pharmaceutical client stock.',
    status: 'todo',
    priority: 'high',
    spaceId: 'space-1',
    folderId: 'folder-1-1',
    listId: 'list-1-1-2',
    assigneeIds: ['user-4', 'user-5'],
    dueDate: tomorrow,
    startDate: todayStr,
    estimatedHours: 3,
    subtasks: [
      { id: 'st-201', title: 'Inspect Zone B sensor 1, 2, 3 physical connections', completed: false },
      { id: 'st-202', title: 'Export 48h telemetry logs to PDF audit report', completed: false },
      { id: 'st-203', title: 'Replace backup lithium coin cells if < 20%', completed: false }
    ],
    tags: ['Quality Audit', 'Compliance', 'Cold-Chain'],
    customFields: {
      slaStatus: 'within_sla',
      department: 'QA & Compliance',
      riskLevel: 'High',
      clientName: 'Quantum Health Enterprises'
    },
    timeLogs: [],
    comments: [],
    activityLogs: [
      {
        id: 'act-102-1',
        userId: 'user-4',
        userName: 'Elena Rostova',
        action: 'Scheduled task for tomorrow',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        type: 'general'
      }
    ],
    order: 2,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-103',
    taskNumber: 'OPS-103',
    title: 'Expedite Air-Freight Dispatch for Apex Global Logistics (12 Pallets)',
    description: 'Urgent customs paperwork and air waybill dispatch required for international air shipment departing at 18:00 local time.',
    status: 'in_progress',
    priority: 'urgent',
    spaceId: 'space-2',
    folderId: 'folder-2-1',
    listId: 'list-2-1-1',
    assigneeIds: ['user-2', 'user-5'],
    dueDate: todayStr,
    startDate: yesterday,
    estimatedHours: 5,
    subtasks: [
      { id: 'st-301', title: 'Verify packing list matches customs declaration (HS Code 8471.50)', completed: true },
      { id: 'st-302', title: 'Generate Air Waybill (AWB #892-4410293)', completed: true },
      { id: 'st-303', title: 'Coordinate customs clearance broker sign-off', completed: false, assigneeId: 'user-2' },
      { id: 'st-304', title: 'Load containers onto Airport Shuttle Truck #7', completed: false, assigneeId: 'user-5' }
    ],
    tags: ['Urgent Freight', 'Customs', 'Air-Cargo'],
    customFields: {
      slaStatus: 'at_risk',
      clientName: 'Apex Global Logistics',
      budget: 4200,
      cost: 3850,
      riskLevel: 'Critical'
    },
    timeLogs: [
      {
        id: 'tl-103',
        userId: 'user-2',
        userName: 'Sarah Jenkins',
        durationMinutes: 120,
        description: 'Completed customs paperwork and AWB generation.',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        billable: true
      }
    ],
    comments: [
      {
        id: 'c-103-1',
        userId: 'user-5',
        userName: 'Marcus Vance',
        userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        content: 'Airport shuttle truck is staged at Bay 4. Waiting for customs stamps.',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ],
    activityLogs: [
      {
        id: 'act-103-1',
        userId: 'user-2',
        userName: 'Sarah Jenkins',
        action: 'Flagged task SLA as At Risk due to customs delay',
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        type: 'status'
      }
    ],
    order: 1,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-104',
    taskNumber: 'OPS-104',
    title: 'Annual Fleet Telematics & GPS Calibration Inspection',
    description: 'Check onboard GPS trackers and OBD-II telemetry units across all 18 delivery vans.',
    status: 'todo',
    priority: 'normal',
    spaceId: 'space-2',
    folderId: 'folder-2-1',
    listId: 'list-2-1-2',
    assigneeIds: ['user-5'],
    dueDate: in5Days,
    startDate: in3Days,
    estimatedHours: 8,
    subtasks: [
      { id: 'st-401', title: 'Inspect Vans 01-09', completed: false },
      { id: 'st-402', title: 'Inspect Vans 10-18', completed: false },
      { id: 'st-403', title: 'Update firmware over 4G eSIM module', completed: false }
    ],
    tags: ['Fleet', 'Maintenance', 'IoT'],
    customFields: {
      slaStatus: 'within_sla',
      department: 'Logistics',
      riskLevel: 'Low'
    },
    timeLogs: [],
    comments: [],
    activityLogs: [],
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-105',
    taskNumber: 'OPS-105',
    title: 'Resolve Platinum Tier SLA Incident: Webhook Delivery Delays',
    description: 'Client reports webhook payload latency exceeding 5000ms. Operations & QA team investigating Redis queue bottleneck.',
    status: 'under_review',
    priority: 'urgent',
    spaceId: 'space-3',
    listId: 'list-3-1',
    assigneeIds: ['user-3', 'user-1'],
    dueDate: todayStr,
    startDate: todayStr,
    estimatedHours: 4,
    subtasks: [
      { id: 'st-501', title: 'Trace latency spike in Grafana Redis telemetry', completed: true },
      { id: 'st-502', title: 'Scale worker consumer instances from 4 to 12', completed: true },
      { id: 'st-503', title: 'Verify client webhook delivery latency dropped < 200ms', completed: true },
      { id: 'st-504', title: 'Issue formal Incident Post-Mortem RCA to client', completed: false }
    ],
    tags: ['SLA-Incident', 'Platinum Client', 'Tier 2'],
    customFields: {
      slaStatus: 'within_sla',
      clientName: 'Apex Global Logistics',
      riskLevel: 'High'
    },
    timeLogs: [
      {
        id: 'tl-105-1',
        userId: 'user-3',
        userName: 'Bilal Ahmed',
        durationMinutes: 90,
        description: 'Investigated Redis worker pool and provisioned additional consumer pods.',
        createdAt: new Date(Date.now() - 5400000).toISOString(),
        billable: false
      }
    ],
    comments: [
      {
        id: 'c-105-1',
        userId: 'user-3',
        userName: 'Bilal Ahmed',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        content: 'Latency dropped to 85ms across all regions. Drafting the RCA document now.',
        createdAt: new Date(Date.now() - 1200000).toISOString()
      }
    ],
    activityLogs: [
      {
        id: 'act-105-1',
        userId: 'user-3',
        userName: 'Bilal Ahmed',
        action: 'Moved status to Under Review',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        type: 'status'
      }
    ],
    order: 1,
    createdAt: new Date(Date.now() - 28800000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-106',
    taskNumber: 'OPS-106',
    title: 'Enterprise Client Onboarding: Data Pipeline Integration',
    description: 'Set up SFTP credentials, automated CSV ingestion mapping, and schedule weekly batch processing for Quantum Health.',
    status: 'in_progress',
    priority: 'high',
    spaceId: 'space-3',
    listId: 'list-3-2',
    assigneeIds: ['user-3', 'user-4'],
    dueDate: in3Days,
    startDate: yesterday,
    estimatedHours: 10,
    subtasks: [
      { id: 'st-601', title: 'Provision isolated AWS S3 bucket and SFTP user', completed: true },
      { id: 'st-602', title: 'Configure JSON/CSV data schema parser', completed: true },
      { id: 'st-603', title: 'Run end-to-end sandbox mock payload test', completed: false, assigneeId: 'user-4' },
      { id: 'st-604', title: 'Hold kick-off handover meeting with client tech lead', completed: false }
    ],
    tags: ['Onboarding', 'Integration', 'Enterprise'],
    customFields: {
      slaStatus: 'within_sla',
      clientName: 'Quantum Health Enterprises',
      budget: 15000,
      riskLevel: 'Medium'
    },
    timeLogs: [
      {
        id: 'tl-106',
        userId: 'user-4',
        userName: 'Elena Rostova',
        durationMinutes: 180,
        description: 'Configured SFTP and schema transformer scripts.',
        createdAt: new Date(Date.now() - 10800000).toISOString(),
        billable: true
      }
    ],
    comments: [],
    activityLogs: [],
    order: 1,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-107',
    taskNumber: 'OPS-107',
    title: 'Quarterly Disaster Recovery Simulation & DB Failover Drill',
    description: 'Execute automated secondary database cluster failover drill without impacting live operational read replicas.',
    status: 'todo',
    priority: 'high',
    spaceId: 'space-4',
    listId: 'list-4-1',
    assigneeIds: ['user-1', 'user-3'],
    dueDate: in5Days,
    startDate: in3Days,
    estimatedHours: 6,
    subtasks: [
      { id: 'st-701', title: 'Take snapshot of primary Postgres cluster', completed: false },
      { id: 'st-702', title: 'Trigger simulated outage on US-East region', completed: false },
      { id: 'st-703', title: 'Measure RTO (Recovery Time Objective) and RPO', completed: false },
      { id: 'st-704', title: 'Document findings in SOP-001 runbook', completed: false }
    ],
    tags: ['Infra', 'Disaster Recovery', 'Security'],
    customFields: {
      slaStatus: 'within_sla',
      department: 'Infrastructure',
      riskLevel: 'High'
    },
    timeLogs: [],
    comments: [],
    activityLogs: [],
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'task-108',
    taskNumber: 'OPS-108',
    title: 'Automate Weekly Vendor SLA Compliance Scorecard Generation',
    description: 'Create scheduled Python/SQL cron script to aggregate vendor fulfillment accuracy and dispatch latency into weekly PDF report.',
    status: 'completed',
    priority: 'normal',
    spaceId: 'space-1',
    listId: 'list-1-loose-1',
    assigneeIds: ['user-1'],
    dueDate: yesterday,
    startDate: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    completedAt: yesterday,
    estimatedHours: 4,
    subtasks: [
      { id: 'st-801', title: 'Draft SQL query for vendor on-time delivery metric', completed: true },
      { id: 'st-802', title: 'Integrate PDF chart renderer', completed: true },
      { id: 'st-803', title: 'Connect automated email distribution list', completed: true }
    ],
    tags: ['Automation', 'Vendors', 'Reporting'],
    customFields: {
      slaStatus: 'within_sla',
      department: 'Operations Automation',
      riskLevel: 'Low'
    },
    timeLogs: [
      {
        id: 'tl-108',
        userId: 'user-1',
        userName: 'Atif Khan',
        durationMinutes: 240,
        description: 'Built scorecard generation pipeline and tested email triggers.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        billable: false
      }
    ],
    comments: [
      {
        id: 'c-108-1',
        userId: 'user-1',
        userName: 'Atif Khan',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        content: 'Automation script live and running every Monday at 06:00 AM UTC.',
        createdAt: new Date(Date.now() - 43200000).toISOString()
      }
    ],
    activityLogs: [
      {
        id: 'act-108-1',
        userId: 'user-1',
        userName: 'Atif Khan',
        action: 'Completed task',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        type: 'status'
      }
    ],
    order: 3,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString()
  }
];

export const INITIAL_DOCS: SOPDocument[] = [
  {
    id: 'doc-1',
    title: 'SOP-001: Critical System Outage & Incident Escalation Protocol',
    category: 'Incident Management',
    spaceId: 'space-1',
    content: `# SOP-001: Critical System Outage & Incident Escalation Protocol

## 1. Purpose & Scope
This Standard Operating Procedure (SOP) defines the mandatory escalation hierarchy, communication channels, and technical containment steps in the event of an operational severity-1 (P1) outage affecting client data or core services.

## 2. Severity Classification Matrix
| Level | Description | Max Response Time | Escalation Contact |
|---|---|---|---|
| **P1 - Critical** | Core systems down, customer operations stopped | **< 15 Minutes** | Ops Director & CTO |
| **P2 - High** | Redundancy compromised, degraded throughput | **< 45 Minutes** | Operations Lead |
| **P3 - Medium** | Non-blocking bug or individual client anomaly | **< 4 Hours** | Support Specialist |

## 3. Step-by-Step Incident Response
1. **Immediate Triage**: The on-duty lead must acknowledge incident within 5 minutes on the central Ops Hub alert channel.
2. **War Room Activation**: Open an emergency voice bridge; invite Lead Engineer, Ops Lead, and Customer Success representative.
3. **Customer Communication**: Post public status page banner within 20 minutes if uptime is impacted.
4. **Post-Mortem Root Cause Analysis (RCA)**: Publish exhaustive RCA report within 48 hours of resolution.

> **Important**: Never perform manual database modifications on production databases without a senior engineer peer review.
`,
    authorId: 'user-1',
    authorName: 'Atif Khan',
    tags: ['SOP', 'Critical', 'Incident Response', 'P1'],
    version: '2.4',
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    starred: true
  },
  {
    id: 'doc-2',
    title: 'SOP-002: Shift Handover & Daily Operational Checklist',
    category: 'Daily Operations',
    spaceId: 'space-1',
    content: `# SOP-002: Shift Handover & Daily Operational Checklist

## 1. Purpose
To ensure seamless continuity of operations between the Morning (08:00 - 16:00), Evening (16:00 - 00:00), and Night (00:00 - 08:00) operations teams.

## 2. Mandatory Handover Procedure
The outgoing shift lead must conduct a 15-minute sync with the incoming lead covering:
- **Active Incident Tickets**: Any unresolved P2/P3 items currently under investigation.
- **Logistics & Dispatch Backlog**: Number of pending freight clearances and high-priority truck departures.
- **Warehouse Safety & Staffing**: Verification that all safety protocols were met and minimum headcount is present.

## 3. Checklist Items
- [x] Run automated backup verify script
- [x] Check cold storage temperature logs
- [ ] Inspect emergency exits & fire suppression indicators
- [ ] Sign off shift attendance register in Ops Hub
`,
    authorId: 'user-2',
    authorName: 'Sarah Jenkins',
    tags: ['SOP', 'Daily Routine', 'Shift Handover'],
    version: '1.8',
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    starred: true
  },
  {
    id: 'doc-3',
    title: 'SOP-003: Vendor SLA Evaluation & Compliance Framework',
    category: 'Vendors & Procurement',
    spaceId: 'space-2',
    content: `# SOP-003: Vendor SLA Evaluation & Compliance Framework

## 1. Objectives
Establish strict evaluation criteria for third-party courier partners, cloud providers, and material suppliers.

## 2. Key Performance Indicators
- **On-Time Delivery Rate**: Minimum 98.5% threshold.
- **Defect / Damage Rate**: Less than 0.2% per shipment lot.
- **Invoice Accuracy**: 100% adherence to agreed contract tariffs.
`,
    authorId: 'user-1',
    authorName: 'Atif Khan',
    tags: ['Vendors', 'SLA', 'Procurement'],
    version: '1.2',
    updatedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    starred: false
  }
];

export const INITIAL_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-1',
    name: 'Auto-Assign Urgent Tasks to Operations Lead',
    description: 'When task priority is set to Urgent, automatically assign Atif Khan and Sarah Jenkins, and flag SLA risk as High.',
    trigger: 'PRIORITY_URGENT',
    actions: [
      { type: 'ASSIGN_USER', value: 'user-1' },
      { type: 'SET_SLA_RISK', value: 'High' }
    ],
    enabled: true,
    executionCount: 14,
    lastExecutedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'auto-2',
    name: 'Auto-Complete Task When All Subtasks Are Done',
    description: 'When all checklist items in a task are completed, transition status directly to Completed.',
    trigger: 'CHECKLIST_COMPLETE',
    actions: [
      { type: 'CHANGE_STATUS', value: 'completed' }
    ],
    enabled: true,
    executionCount: 29,
    lastExecutedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'auto-3',
    name: 'Auto-Tag Critical Support Escalations',
    description: 'When a new task is created in Customer SLA space with Urgent priority, tag with [SLA-Incident].',
    trigger: 'TASK_CREATED',
    actions: [
      { type: 'ADD_TAG', value: 'SLA-Incident' }
    ],
    enabled: true,
    executionCount: 8,
    lastExecutedAt: new Date(Date.now() - 28800000).toISOString()
  }
];

export const INITIAL_CLIENTS_VENDORS: ClientVendor[] = [
  {
    id: 'cv-1',
    name: 'Apex Global Logistics',
    type: 'client',
    contactPerson: 'David Miller (VP Operations)',
    email: 'dmiller@apexlogistics.com',
    phone: '+1 (555) 234-8900',
    slaTier: 'Platinum (99.9%)',
    status: 'active',
    activeContracts: 4,
    monthlyValue: '$48,500/mo',
    notes: 'Key enterprise freight client. Requires instant webhook sync and dedicated account manager.'
  },
  {
    id: 'cv-2',
    name: 'CloudCore Data Centers',
    type: 'vendor',
    contactPerson: 'Rachel Zhang (Account Director)',
    email: 'rzhang@cloudcore.io',
    phone: '+1 (555) 872-1199',
    slaTier: 'Gold (99.5%)',
    status: 'active',
    activeContracts: 2,
    monthlyValue: '$12,200/mo',
    notes: 'Primary hosting and colocation provider for Tier 3 warehouse facilities.'
  },
  {
    id: 'cv-3',
    name: 'FastRoute Courier Express',
    type: 'partner',
    contactPerson: 'Tariq Mehmood (Regional Head)',
    email: 't.mehmood@fastroute.net',
    phone: '+44 20 7946 0192',
    slaTier: 'Gold (99.5%)',
    status: 'active',
    activeContracts: 3,
    monthlyValue: '$26,000/mo',
    notes: 'Same-day metro dispatch partner. Weekly SLA audits required.'
  },
  {
    id: 'cv-4',
    name: 'Quantum Health Enterprises',
    type: 'client',
    contactPerson: 'Dr. Clara Thorne (Supply Chain Lead)',
    email: 'cthorne@quantumhealth.org',
    phone: '+1 (555) 901-4421',
    slaTier: 'Platinum (99.9%)',
    status: 'active',
    activeContracts: 1,
    monthlyValue: '$65,000/mo',
    notes: 'Pharmaceutical client with strict cold-chain compliance requirements (-20C).'
  }
];
