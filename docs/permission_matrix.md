# Phase 3B: Task Management & Review Permission Matrix

| Operation / Transition | Owner | Operational Manager | Team Member | Client User | Business / Safeguard Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Create Task** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Paused/Archived client rejected (400). Planned start & due date cannot fall on Sat/Sun. |
| **Update Task Fields** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Blocked on Paused/Archived client (400) or Archived task (404). Sat/Sun dates rejected. |
| **Assign / Reassign Task** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Assignee must be active, non-client, explicit client access grant, and belong to task department. |
| **Draft -> Assigned** | Allowed | Allowed | Denied (403) | Denied (403) | Requires valid assignee. |
| **Assigned -> In Progress** | Allowed | Allowed | Allowed (Assigned task only) | Denied (403) | Starts operational work. |
| **In Progress -> Blocked** | Allowed | Allowed | Allowed (Assigned task only) | Denied (403) | Mandatory reason required (recorded in task and audit event). |
| **Blocked -> In Progress** | Allowed | Allowed | Allowed (Assigned task only) | Denied (403) | Clears blocked reason; resumes work. |
| **In Progress -> Team Review** | Allowed | Allowed | Allowed (Assigned task only) | Denied (403) | Team member can submit only their own assigned work. |
| **Team Review -> In Progress** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Mandatory return reason required (event: review_returned). |
| **Team Review -> Completed** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Allowed ONLY for Internal Only tasks. Tasks requiring client approval must move to Client Review. |
| **Team Review -> Client Review** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Allowed ONLY for Client Approval Required tasks. |
| **Client Review -> Completed** | Allowed (Owner Override ONLY) | Strictly Denied (403) | Denied (403) | Allowed (Mapped client only) | Operational Managers CANNOT approve on behalf of client. Owner requires explicit is_override: true, mandatory override reason, and records client_approval_override event. |
| **Client Review -> In Progress** | Allowed | Allowed (Assigned client only) | Denied (403) | Allowed (Mapped client only) | Mandatory revision feedback required (event: client_changes_requested for Client; changes_requested for Staff). |
| **Completed -> In Progress (Reopen)** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Mandatory reason required (recorded in reopen_reason, reopened_at, reopened_by). |
| **Archive Task** | Allowed | Allowed (Assigned client only) | Denied (403) | Denied (403) | Mandatory archive reason required. Freezes task and conversation feed permanently into read-only. |
| **Post Internal Note** | Allowed | Allowed | Allowed (Assigned client) | Strictly Denied (403) | Visibility: internal_note. Never exposed to clients via RLS or Edge Function feed. Permitted for Paused clients (Manager/Owner only). |
| **Post Shared Message** | Allowed | Allowed | Allowed (Assigned client) | Allowed (Mapped client only) | Visibility: shared_with_client. Blocked for Paused clients (400). |
| **External Links in Message** | Allowed | Allowed | Allowed | Allowed | Maximum 5 links. HTTPS only, <= 2048 chars, no embedded credentials. |
| **Feed Inspection** | All items | All items (in scope) | All items (in scope) | Client-facing items only | Client users never receive internal notes, internal-event payloads (e.g. review returns, unblocking, reopen reasons), or staff emails. |
