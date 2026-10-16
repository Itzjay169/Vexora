# ADR-009: Compliance with India DPDP Act 2023, IT Intermediary Rules & Minors

## Status
Accepted

## Context (Blueprint Section 24 & Section 31)
Operating in India requires strict adherence to the Digital Personal Data Protection (DPDP) Act 2023, Information Technology Intermediary Guidelines (2021/2023 amendments), and state-level online gaming laws.

## Decision
1. **Data Principal Rights & Consent**:
   - Explicit, affirmative, itemized consent required at registration for processing gaming data and identity verification.
   - Built-in user self-service portal to Export Data (JSON) and Request Account Erasure within 30-day SLA.
   - Financial and anti-fraud audit logs are retained as legally mandated (180 days for IT Rules, 5 years for financial transactions) in pseudonymised archives before physical destruction.
2. **Protection of Minors**:
   - Minimum age for platform registration is 16.
   - Players aged 16-17 must provide verifiable parental/guardian consent and are restricted to free tournaments only.
   - Minors cannot participate in paid-entry or cash-prize tournaments under any circumstance.
3. **Intermediary Obligations & Grievance Officer**:
   - Appointment of a dedicated Resident Grievance Officer with published contact information (`grievance@vexora.gg`).
   - Grievance acknowledgment within 24 hours, resolution within 15 days.
   - Takedown procedures for infringing or illegal content within 36 hours of receipt of notice.
4. **Geo-Eligibility Restrictions**:
   - Paid tournament features are strictly blocked in Indian states with statutory prohibitions on paid online competitions (e.g. Telangana, Andhra Pradesh, Assam, Odisha, Nagaland, Sikkim) via IP and KYC verification.

## Consequences
- Full statutory compliance across national and state legal jurisdictions.
- Clear operational timelines for legal notices and user privacy requests.
