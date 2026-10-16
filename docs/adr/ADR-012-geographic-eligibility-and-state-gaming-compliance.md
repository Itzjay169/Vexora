# ADR-012: Geographic Eligibility, State-Level Gaming Law Compliance & Geofencing

## Status
Accepted

## Context (Blueprint Section 31, Question 17; Section 24; Section 50)
Indian gaming law distinguishes between "games of skill" and "games of chance". While competitive esports (BGMI, Free Fire, Call of Duty Mobile) are recognized as games of predominantly skill under Supreme Court jurisprudence (*State of Bombay v. R.M.D. Chamarbaugwala*, *K.R. Lakshmanan v. State of Tamil Nadu*), individual Indian states have enacted divergent statutory frameworks regarding online gaming, stakes, and prize competitions.

## Decision

### 1. Dual-Phase Jurisdiction Strategy
1. **Phase 1 Launch Scope (v1 Public Launch)**:
   - **100% Free Tournaments Only**: Zero entry fees, zero monetary stakes, zero user financial contributions.
   - **Eligibility**: Open to all eligible residents of India across all 28 states and 8 union territories, provided they meet age (16+) and identity guidelines.
   - Because no money is wagered or staked, free skill competitions are universally permissible under national and state laws.

2. **Phase 2+ Future Scope (Paid Entry / Monetary Stakes - Post-Legal Sign-Off Only)**:
   - **Strict Geographic Exclusion**: Paid entry tournaments and cash prize redemption will be geofenced and strictly prohibited in states with statutory prohibitions or licensing mandates:
     - **Andhra Pradesh** (AP Gaming Act amendments)
     - **Telangana** (Telangana Gaming Act amendments)
     - **Assam** (Assam Game and Betting Act)
     - **Odisha** (Orissa Prevention of Gambling Act)
     - **Nagaland** (Pending state skill game license)
     - **Sikkim** (Pending state online gaming license)
     - **Tamil Nadu** (Subject to current judicial orders under TN Prohibition of Online Gambling Act)
   - Real-money features remain permanently disabled (`ENABLE_REAL_MONEY=false`) in software until formal written legal opinion is issued and countersigned.

### 2. Geofencing & Verification Mechanism
- **Multi-Factor Geo-Location Verification**:
  1. IP Geolocation check at session initiation and match entry.
  2. Mobile device network carrier / SIM country code validation.
  3. KYC address verification (Aadhaar / Voter ID PIN code check) prior to any wallet withdrawal or paid entry.
- **VPN / Proxy Detection**:
  - Connections via commercial VPNs, Tor exit nodes, or data center proxies are flagged; tournament entry is blocked until normal ISP connection is restored.

### 3. International Player Policy
- Launch phase restricts tournament participation to residents of India.
- International expansion requires country-specific legal review for COPPA/GDPR, local tax withholding, and currency exchange controls (RBI FEMA regulations).

## Consequences
- Guarantees zero legal liability at v1 launch by maintaining a strictly free competitive platform.
- Provides a ready, pre-architected geofencing engine for controlled rollout if paid competitions are ever authorized.
