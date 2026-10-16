# ADR-014: Grievance Redressal Mechanism & Officer Appointment under IT Rules 2021

## Status
Accepted

## Context (Blueprint Section 31, Question 19; Section 24; Section 23)
Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (as amended in 2022 and 2023 for online gaming), digital intermediaries operating in India must appoint a Resident Grievance Officer, publish their contact details, and strictly adhere to statutory timelines for complaint acknowledgment and resolution.

## Decision

### 1. Appointment of Resident Grievance Officer
- **Title / Role**: Resident Grievance Officer (RGO), Vexora India.
- **Physical Nexus**: Stationed in Bengaluru, Karnataka, India.
- **Contact Details**:
  - **Email**: `grievance@vexora.gg`
  - **Postal Address**: Vexora Esports Grievance Redressal Office, 4th Floor, Tech Hub, Bengaluru 560001, India.
  - **In-App Portal**: Dedicated "Submit Grievance" form accessible from Profile -> Support -> Legal & Grievance.

### 2. Statutory Timelines & Operational SLAs

| Event Type | Statutory Legal Requirement | Vexora Internal SLA | Escalation Target |
| :--- | :--- | :--- | :--- |
| **Grievance Receipt Acknowledgment** | Max 24 hours (Rule 3(2)) | **Within 4 hours** | Auto-ack with Ticket ID & verification link |
| **Standard Grievance Resolution** | Max 15 days (Rule 3(2)) | **Within 72 hours** | Grievance Officer + Legal Reviewer |
| **Emergency Takedown (Nudity/Impersonation)** | Max 24 hours (Rule 3(2)(b)) | **Within 2 hours** | Immediate content quarantine |
| **Court / Government Takedown Order** | Max 36 hours (Rule 3(1)(d)) | **Within 6 hours** | Head of Legal & Lead Admin |
| **Appeals to Grievance Appellate Committee (GAC)** | User can appeal within 30 days of RGO decision | Compliance within 15 days of GAC order | Executive Leadership |

### 3. Grievance Tracking System Architecture
- All incoming grievance emails and portal submissions are routed into a dedicated, audit-trailed ticket queue.
- Tickets cannot be deleted; resolution requires a formal, written statement of rationale and relevant policy clauses cited.
- An automated alert triggers if a ticket reaches 48 hours without progress, alerting senior operations leadership.

### 4. Monthly Transparency Reporting
- Vexora will maintain a public compliance report repository updated monthly, detailing:
  - Total grievances received.
  - Breakdown by category (cheating, toxicity, account dispute, technical error).
  - Number of grievances resolved and average resolution time.
  - Content takedown actions taken under Rule 3(2)(b) and court orders.

## Consequences
- Protects Vexora's intermediary safe-harbor immunity under Section 79 of the Information Technology Act, 2000.
- Provides users with a transparent, legally enforceable channel for redressing legitimate complaints.
- Establishes clear accountability and rapid incident response protocols.
