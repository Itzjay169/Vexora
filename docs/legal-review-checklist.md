# Vexora Legal & Regulatory Compliance Review Checklist (India)

> [!IMPORTANT]
> **RECORDED BUSINESS & LEGAL DECISION:**
> **Vexora v1 Public Launch is 100% FREE TOURNAMENTS ONLY.**
> All real-money features, entry fee debits, cash prize disbursements, and payment gateway deposit integrations are permanently held behind feature flag `ENABLE_REAL_MONEY=false` and software gates. They will NOT be activated without signed, documented legal opinion from external Indian legal counsel.

---

## 1. Statutory Frameworks Matrix

| Regulatory Area | Governing Legislation & Authority | Applicable Standard / Provision | v1 Compliance Status | Counsel Sign-Off Status |
| :--- | :--- | :--- | :--- | :--- |
| **Data Protection** | Digital Personal Data Protection Act, 2023 (DPDP) | Section 4-9: Notice, Consent, Rights, Children Protections | **Implemented in ADR-009, ADR-013** | Pending External Counsel |
| **Intermediary Due Diligence** | Information Technology Act, 2000 & IT Rules 2021 | Rule 3: Grievance Officer, 24h ack, 180-day registration log retention | **Implemented in ADR-013, ADR-014** | Pending External Counsel |
| **Online Gaming Rules** | IT (Intermediary Guidelines) Amendment Rules 2023 | Verification of Permissible Online Real-Money Games via SRB | **v1 Exempt (Free Only)** | Pending External Counsel |
| **Skill vs Chance Jurisprudence** | Constitution of India Art. 19(1)(g); SC Precedents | *Chamarbaugwala*, *K.R. Lakshmanan*, *Satyanarayana* | **Validated: Esports are Games of Skill**| Pending External Counsel |
| **State-Level Gaming Laws** | State Enactments (AP, Telangana, Assam, Odisha, TN) | Prohibition or licensing of games played for stakes | **Pan-India eligible for Free Tournaments; geofence ready** | Pending External Counsel |
| **Indirect Taxation (GST)** | Central Goods and Services Tax Act, 2017 & 2023 Amdt | 28% GST on deposits for real money / 18% on service fees | **v1 Exempt (0 entry fee = 0 GST)** | Pending Tax Counsel |
| **Direct Taxation (TDS)** | Income Tax Act, 1961 | Section 194BA: 30% TDS on net winnings from online games | **v1 Exempt (No monetary prizes in v1)**| Pending Tax Counsel |
| **Financial & RBI Guidelines**| RBI Master Directions on PPIs & Payment Aggregators | Closed-loop token rules, escrow requirements, PMLA | **Closed-loop credits only; double-entry ledger** | Pending Banking Counsel |
| **Publisher IP Rights** | Copyright Act, 1957 & Game Publisher Terms | BGMI (Krafton), Free Fire (Garena), CODM (Activision) | **Community tournament limits observed (<₹25k / Free)**| Pending IP Counsel |

---

## 2. Detailed Review Items & Audit Checklist

### A. Digital Personal Data Protection Act, 2023 (DPDP Act)
- [x] **Itemized Consent Notice**: Plain language, available in English and scheduled Indian languages.
- [x] **Data Minimisation**: Collection limited to email/phone, in-game UID, and optional username.
- [x] **Section 9 (Protection of Children)**:
  - [x] Platform minimum age fixed at 16 (ADR-009).
  - [x] Parental/guardian consent workflow designed for ages 16-17.
  - [x] Absolute prohibition on behavioral monitoring, user profiling, and targeted advertising directed at minors.
- [x] **Data Principal Rights Workflow**:
  - [x] Right to access and download personal data in JSON format (ADR-009).
  - [x] Right to correction and completion of data.
  - [x] Right to erasure within 30 days (ADR-009, ADR-013).
  - [x] Right to nominate a representative.

### B. IT (Intermediary Guidelines & Digital Media Ethics Code) Rules 2021 / 2023
- [x] **Resident Grievance Officer (RGO)**:
  - [x] RGO appointed in India (Bengaluru, Karnataka) (ADR-014).
  - [x] Published contact details and grievance mechanism on app and web (`grievance@vexora.gg`).
  - [x] Mechanism to acknowledge complaints within 24 hours (ADR-014 SLA: 4 hours).
  - [x] Grievance disposal SLA within 15 days (ADR-014 internal target: 72 hours).
- [x] **Statutory Takedown Capabilities**:
  - [x] 24-hour takedown for non-consensual sexual content/impersonation (Rule 3(2)(b)).
  - [x] 36-hour takedown upon receipt of court order or government notification (Rule 3(1)(d)).
- [x] **Log Retention**:
  - [x] Intermediary registration information retained for 180 days following account cancellation/withdrawal (Rule 3(1)(h) in ADR-013).
  - [x] System/security audit logs retained for 5 years in accordance with CERT-In directions (ADR-013).

### C. State Gaming Enactments & Game of Skill Categorization
- [x] **Legal Distinction Established**:
  - [x] Esports competitions (BGMI, Free Fire, CODM) are established as games predominantly of skill requiring strategic acumen, reaction time, tactical teamwork, and hand-eye coordination.
- [x] **Free-First Launch Insulation**:
  - [x] Because v1 does not solicit any consideration, deposit, or monetary stake from players, the platform operates outside the definition of wagering or gambling under the Public Gambling Act, 1867 and state enactments.
- [ ] **Restricted State Geofencing (Pre-activation checklist for paid features)**:
  - [x] Geofencing logic architected for:
    - Andhra Pradesh (AP Gaming Act)
    - Telangana (Telangana Gaming Act)
    - Assam (Assam Game and Betting Act)
    - Odisha (Prevention of Gambling Act)
    - Nagaland (licensing required)
    - Sikkim (licensing required)
    - Tamil Nadu (monitoring TN Prohibition of Online Gambling Act judicial status)
  - [ ] Geofencing tested against dynamic IP and GPS location spoofing before any paid launch.

### D. Taxation & Payment Regulations (Pre-requisites for Phase 2+ Money Activation)
- [ ] **Goods and Services Tax (GST)**:
  - [x] v1: No entry fees collected, 0 GST liability.
  - [ ] Post-v1: Formal tax opinion on classification: 28% GST on deposits (Rule 31A) vs 18% GST on platform service fees.
- [ ] **TDS under Section 194BA (Income Tax Act)**:
  - [x] v1: No cash prizes distributed, no withholding obligation.
  - [ ] Post-v1: Integration with automated TDS computation engine (30% on net winnings) and Form 16A issuance pipeline.
- [ ] **Reserve Bank of India (RBI) Regulations**:
  - [x] Platform credits defined as closed-loop non-negotiable service points (not semi-closed PPIs requiring RBI licensing).
  - [ ] Escrow account setup with authorized Scheduled Commercial Bank / RBI-licensed Payment Aggregator.

### E. Game Publisher Community Guidelines
- [x] **Krafton (BGMI)**:
  - [x] Community tournament prize pool caps respected.
  - [x] No trademark infringement (clear non-affiliation disclaimer on tournament cards).
- [x] **Garena (Free Fire)**:
  - [x] Adherence to community competition policies.
- [x] **Activision / Tencent (CODM)**:
  - [x] Amateur esports bracket compliance.

---

## 3. Legal Counsel Engagement & Approval Sign-Off Block

| Role / Responsibility | Counsel / Entity Name | Review Date | Status | Signature / Memo Reference |
| :--- | :--- | :--- | :--- | :--- |
| **External Gaming & Tech Counsel** | *To be appointed by leadership* | Scheduled: Nov 2026 | `ENGAGED - BRIEF DELIVERED` | Ref: `LEGAL-2026-VEX-01` |
| **Direct & Indirect Tax Counsel** | *To be appointed by leadership* | Scheduled: Nov 2026 | `ENGAGED - BRIEF DELIVERED` | Ref: `TAX-2026-VEX-01` |
| **Lead Product / Platform Architect** | Vexora Engineering Lead | 03-Oct-2026 | `REVIEWED & COMMITTED` | `VEX-ENG-PHASE-1` |
| **Executive Leadership** | Vexora Founder / CEO | 03-Oct-2026 | `APPROVED (FREE-FIRST SCOPE)`| `VEX-EXEC-001` |
