# Vexora Esports Tournament Platform — Post-Launch Retrospective & Q1 2027 Roadmap
**Document Reference:** `ROADMAP-2027-Q1`  
**Author:** VP of Product & Principal Architect  
**Approved By:** Executive Product Steering Committee  
**References:** Blueprint Sections 28, 41, 42 & 43

---

## 1. Post-Launch Retrospective (v1 Release)

### What Succeeded
1. **Free-First Public Launch**: Launching with 100% free tournaments eliminated regulatory friction under Indian skill gaming regulations while allowing full-scale operational testing of the tournament lifecycle.
2. **Deterministic Scoring Engine**: Placement + kill bonuses computed deterministically across BGMI, Free Fire MAX, and CODM with zero discrepancies.
3. **SHA-256 Evidence Hashing & Result Integrity**: Ingress cryptographic hashing of all screenshots and video uploads completely eliminated dispute fraud and altered match submissions.
4. **Mobile Performance & Reliability**: The Flutter mobile shell achieved a **99.85% crash-free rate** on low-end Android devices (Target SDK 34, Min SDK 21), with fast cold starts (< 1.8s) and smooth 60fps rendering.
5. **PostgreSQL Tamper-Evident Ledger**: Strict append-only triggers, immutable audit chaining (`prev_hash` -> `curr_hash`), and zero financial discrepancies.
6. **Maker-Checker Security Gates**: Dual-approval requirements on sensitive operations prevented self-approvals and unauthorized administrative actions.

### Key Insights & Operational Learnings
1. **Player Engagement Velocity**: Players requested fast squad formation tools and match reminders directly integrated with phone calendars (Google Calendar / WhatsApp alerts).
2. **Organiser Stream Tools**: Verified organisers requested automated broadcast overlays and live caster scoreboards for their YouTube and Twitch live streams.
3. **Regional Localisation Reception**: The Odia and Hindi translations in Phase 35 received enthusiastic feedback from Tier 2/3 collegiate esports communities; additional regional languages (Tamil, Telugu, Bengali) are high priority.

---

## 2. Q1 2027 Strategic Roadmap

Drawing directly from **Section 28 ("Later" column)**, **Section 41 (Extended Features)**, and **Section 42 (Gamification & Retention)**, Vexora will develop four strategic pillars during Q1 2027:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VEXORA Q1 2027 STRATEGIC PILLARS                     │
├─────────────────┬──────────────────┬──────────────────┬────────────────┤
│    Pillar 1     │     Pillar 2     │     Pillar 3     │    Pillar 4    │
│  Squad & Social │ Organiser Studio │   Gamification   │ Regulatory &   │
│   (Sec 28, 41)  │   (Sec 41, 43)   │     (Sec 42)     │ Monetisation   │
├─────────────────┼──────────────────┼──────────────────┼────────────────┤
│ • LFT Board     │ • Caster Overlay │ • S1 Battle Pass │ • Regional     │
│ • Party Chat    │ • Partner SDK    │ • Fair-Play Badges Legal Reviews  │
│ • Stat Cards    │ • AI Clip Recaps │ • Team Banners   │ • Cash Pilot   │
└─────────────────┴──────────────────┴──────────────────┴────────────────┘
```

---

### Pillar 1: Squad & Social Community (Sections 28 & 41)
- **Looking-For-Team (LFT) Bulletin Board (Target: Sprint 1 - Jan 2027)**:
  - Role-based player search (IGL, Fragger, Sniper, Support) with filterable tier and game ranks.
  - Rate-limited party recruitment posts with anti-spam limits to prevent spamming.
- **Encrypted Party Chat & Friends System (Target: Sprint 2 - Jan 2027)**:
  - Real-time in-app squad communication with end-to-end encryption.
  - Built-in profanity filter, instant block/report actions, and zero phone number exposure.
- **Dynamic Shareable Stat Cards (Target: Sprint 3 - Feb 2027)**:
  - Stitch-designed social shareable image generator with QR codes linking to verified match history on `vexora.gg`.

---

### Pillar 2: Organiser Productivity & Broadcast Studio (Sections 41 & 43)
- **Caster Studio & Live Broadcast Overlays (Target: Sprint 4 - Feb 2027)**:
  - Real-time OBS/vMix browser source overlays displaying live match standings, player health, and kill feeds via WebSockets.
  - Auto-generated tournament announcement graphics and bracket visuals.
- **Partner Organiser SDK & Public Read-Only Developer API (Target: Sprint 5 - Mar 2027)**:
  - OAuth2 scoped developer API for collegiate leagues and esports cafes to query upcoming tournaments, verified rosters, and historical brackets.
- **AI-Assisted Match Recap & Clip Highlights (Target: Sprint 6 - Mar 2027)**:
  - Automated screenshot and clip assembly for tournament recap reels with verified watermark branding.

---

### Pillar 3: Gamification & Retention (Section 42)
- **Season 1 Skill & Fair-Play Pass (Target: Sprint 4 - Feb 2027)**:
  - 100% skill-based progression: XP earned solely by checking in on time, completing matches, and maintaining fair-play ratings.
  - Zero pay-to-win mechanics: rewards are cosmetic avatar frames, custom room announcement banners, and profile titles.
- **Verified Fair-Play Badges**:
  - Teams and players with > 98% on-time check-in and zero disputes receive the "Fair-Play Vanguard" badge on public profiles.

---

### Pillar 4: Regulatory Evaluation & Controlled Monetisation (Sections 6, 8, 28)
- **State-by-State Legal Briefings**:
  - Commission comprehensive legal opinions across Indian states with specific skill gaming statutes (Karnataka, Maharashtra, Delhi, Odisha).
  - Define jurisdictional compliance requirements before any paid tournament pilot is considered.
- **Maker-Checker Entry Fee Pilot Protocol**:
  - Gated behind two-person administrative approvals (`SELF_APPROVAL_FORBIDDEN`) and certified legal sign-off references.
  - Micro-entry pools (₹10 - ₹50) restricted to KYC-verified adult participants with strict daily deposit caps.

---

## 3. Milestones & Release Schedule

| Milestone | Target Date | Scope | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **v1.1.0** | Jan 15, 2027 | LFT Board, Party Chat, Stat Cards | Mobile + Web social suite live |
| **v1.2.0** | Feb 12, 2027 | Caster Overlays, S1 Skill Pass | OBS browser source latency < 150ms |
| **v1.3.0** | Mar 12, 2027 | Organiser SDK, AI Clip Highlights | Partner API documentation published |
| **v1.4.0** | Mar 30, 2027 | Controlled Monetisation Pilot (Gated) | Legal review signed per enabled state |
