# Data Breach & Statutory Regulatory Notification Runbook

**Statutory Framework**: Digital Personal Data Protection (DPDP) Act 2023 & CERT-In Cyber Security Directions  
**Severity**: SEV-1 (Critical)  
**Owners**: Data Protection Officer (DPO), Grievance Officer, General Counsel, CEO  

---

## 1. Trigger Conditions
- Confirmed unauthorized access, exfiltration, alteration, or exposure of personal data (PII), Aadhaar/PAN KYC documents, or financial records.
- Ransomware attack, cloud credential exposure, or database dump publication.

---

## 2. Mandatory Statutory Timelines
1. **CERT-In Reporting (Cyber Security Incidents)**:
   - **Deadline**: Within **6 hours** of noticing or being brought to notice of the incident.
   - **Submission Channel**: Incident report to `incident@cert-in.org.in`.
2. **Data Protection Board of India (DPBI)**:
   - **Deadline**: Prompt notice as specified under DPDP Act 2023 rules.
3. **Data Principal (User) Notification**:
   - Provide clear, plain-language notification detailing:
     - Nature of the breach.
     - Categories of personal data compromised.
     - Steps taken by Vexora to mitigate harm.
     - Recommendations for users (e.g., password reset, 2FA update, bank account monitoring).
     - Contact details of Vexora Grievance Officer (`grievance-officer@vexora.gg`).

---

## 3. Immediate Containment Workflow
1. Isolate compromised networks, revoke keys, and patch vulnerability.
2. Engage external independent digital forensics & incident response (DFIR) specialists.
3. Preserve forensic chain of custody for all system logs, memory dumps, and disk snapshots.
4. Document all remediation actions chronologically in the breach register.
