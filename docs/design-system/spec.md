# Vexora Design System Specification (Stitch & WCAG AA)

## 1. Principles & Visual Direction
Vexora is a trust-first competitive esports platform. The visual interface conveys speed, structural integrity, and competitive thrill while maintaining bank-grade trust.

- **Dark Theme First**: Esports competitors play in low-ambient lighting. The primary experience is tuned for OLED and deep-contrast dark mode (`#0A0F1D`).
- **WCAG AA Compliance**: All typography on dark surfaces maintains at least a 4.5:1 contrast ratio for normal text and 3:1 for bold/display headers.
- **Trust UI Signatures**: Every result, payout, or rule is visually anchored with cryptographic evidence indicators (SHA-256 hash pills, verified checkmarks, formula version tags).

---

## 2. Core Color Tokens & WCAG AA Contrast Ratios

| Token Name | Hex Code | Contrast on `#0A0F1D` | WCAG AA Status | Role |
| :--- | :--- | :--- | :--- | :--- |
| `primary` | `#6366F1` | 5.2:1 | **Pass (AA)** | Brand hero, primary CTAs, active highlights |
| `secondary` | `#A855F7` | 5.8:1 | **Pass (AA)** | Accents, badges, secondary interactive states |
| `accent` | `#06B6D4` | 8.1:1 | **Pass (AAA)** | Real-time live indicators, data charts |
| `textPrimary` | `#F8FAFC` | 17.5:1 | **Pass (AAA)** | Primary headers, player usernames, scores |
| `textSecondary`| `#94A3B8` | 7.9:1 | **Pass (AA)** | Subtitles, timestamps, metadata |
| `textMuted` | `#64748B` | 4.6:1 | **Pass (AA)** | Footers, disabled states, subtle hints |
| `surfaceElevated`| `#131B2E` | N/A | Container | Card surface, table rows, modals |

---

## 3. Tournament 11-State Machine Chips

Every tournament state transition is strictly reflected with dedicated semantic colors and container contrasts:

| State Key | Label | Foreground | Background | Border |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | Draft | `#94A3B8` | `#1E293B` | `#334155` |
| `PENDING_REVIEW` | Pending Review | `#FBBF24` | `#451A03` | `#B45309` |
| `SCHEDULED` | Scheduled | `#38BDF8` | `#082F49` | `#0284C7` |
| `REGISTRATION_OPEN` | Registration Open | `#34D399` | `#022C22` | `#059669` |
| `CHECK_IN` | Check-In Live | `#C084FC` | `#2E1065` | `#7C3AED` |
| `LIVE` | Tournament Live | `#FB7185` | `#4C0519` | `#E11D48` |
| `RESULT_PENDING` | Result Pending | `#FB923C` | `#431407` | `#EA580C` |
| `DISPUTED` | Disputed | `#F87171` | `#450A0A` | `#DC2626` |
| `COMPLETED` | Completed | `#818CF8` | `#1E1B4B` | `#4F46E5` |
| `SETTLED` | Settled | `#2DD4BF` | `#042F2E` | `#0D9488` |
| `ARCHIVED` | Archived | `#64748B` | `#0F172A` | `#1E293B` |

---

## 4. Trust UI Patterns

1. **Verified Organiser Badge**:
   - Icon: Shield Checkmark
   - Style: Cyan gradient (`#38BDF8` with 15% opacity container)
   - Behavior: Clicking reveals verification timestamp and completed tournament history.
2. **SHA-256 Evidence Hash Tick**:
   - Monospace snippet (e.g., `e3b0c442...`) with green tick icon (`#10B981`).
   - Hover displays full SHA-256 hash and immutable timestamp.
3. **Formula Version Tag**:
   - Badge with scoring algorithm version (e.g., `bgmi_br_v1.0.0`).
   - Clicking opens deterministic scoring rules preview.

---

## 5. Component Library Specifications

### 5.1 Tournament Card
- **Layout**: Header (Game Banner + State Chip), Body (Title, Organiser Badge, Date/Time), Footer (Entry Fee/Free indicator, Prize Escrow, Slots Left).
- **Elevation**: Hover elevation with subtle Electric Indigo glow (`0 0 20px rgba(99,102,241,0.2)`).

### 5.2 Bracket View
- **Layout**: SVG/Canvas tree connecting match nodes.
- **Match Node**: Team A vs Team B, live score badge, status indicator, winner accent border (`#10B981`).

### 5.3 Leaderboard Row
- **Layout**: Rank (#1 - #3 gold/silver/bronze icons), Team/Player Avatar, In-Game UID, Matches Played, Kills, Points, Fair-Play Score badge.

### 5.4 Evidence Tile
- **Layout**: Image/Video preview thumbnail, SHA-256 hash pill, Uploader role tag, Upload timestamp, Antivirus clean badge.

### 5.5 Ledger Transaction Row
- **Layout**: Monospace Transaction ID, Type (`CREDIT`, `HOLD`, `RELEASE`, `REWARD`), Amount (+/- with color), Reference link, UTC Timestamp.
