# ADR-015: Exact Mathematical Scoring Formulas for Launch Esports Titles

## Status
Accepted

## Context (Blueprint Section 31, Question 15; Section 5; Section 7)
Tournament fairness requires deterministic, mathematically unambiguous scoring formulas for all supported games. Tie-breaking rules must be codified down to the last edge case so that player standings and prize/badge distributions are computed without human ambiguity or subjective bias.

## Decision

### 1. Battlegrounds Mobile India (BGMI) - Battle Royale Mode
- **Version ID**: `bgmi_br_v1.0.0`
- **Total Points Formula**:
  $$\text{Total Score} = \text{Placement Points} + (\text{Kill Count} \times \text{Kill Value})$$
  Where $\text{Kill Value} = 1\text{ pt per kill}$.

- **Placement Points Table**:
  | Placement | Placement Points | Placement | Placement Points |
  | :--- | :--- | :--- | :--- |
  | **1st (WWCD)** | 10 pts | **6th** | 2 pts |
  | **2nd** | 6 pts | **7th** | 1 pt |
  | **3rd** | 5 pts | **8th** | 1 pt |
  | **4th** | 4 pts | **9th - 16th** | 0 pts |
  | **5th** | 3 pts | | |

- **Multi-Match Aggregate Tie-Breaking Hierarchy**:
  1. Highest total cumulative Placement Points across all matches in the set.
  2. Highest total cumulative Kill Points.
  3. Highest number of 1st-place finishes (WWCD).
  4. Most recent match placement (head-to-head performance in final match).

---

### 2. Garena Free Fire - Battle Royale Mode
- **Version ID**: `freefire_br_v1.0.0`
- **Total Points Formula**:
  $$\text{Total Score} = \text{Placement Points} + (\text{Kill Count} \times \text{Kill Value})$$
  Where $\text{Kill Value} = 1\text{ pt per kill}$.

- **Placement Points Table**:
  | Placement | Placement Points | Placement | Placement Points |
  | :--- | :--- | :--- | :--- |
  | **1st (Booyah)** | 12 pts | **6th** | 4 pts |
  | **2nd** | 9 pts | **7th** | 3 pts |
  | **3rd** | 8 pts | **8th** | 2 pts |
  | **4th** | 7 pts | **9th** | 1 pt |
  | **5th** | 6 pts | **10th - 12th**| 0 pts |

- **Multi-Match Aggregate Tie-Breaking Hierarchy**:
  1. Highest total Booyah (1st place) finishes.
  2. Highest total cumulative Kill Points.
  3. Placement in the final round of the series.

---

### 3. Call of Duty Mobile (CODM) - Multiplayer Mode
- **Version ID**: `codm_mp_v1.0.0`
- **Match Types**:
  - **Search & Destroy (S&D)**: First team to win 7 rounds (Best of 13 rounds).
    - Match Win = 3 Match Points; Match Loss = 0 Match Points.
    - Tie-breaker = Round Differential $(\text{Rounds Won} - \text{Rounds Lost})$.
  - **Hardpoint**: First team to reach 250 points or highest score when 10-minute timer expires.
    - Match Win = 3 Match Points; Match Loss = 0 Match Points.
    - Tie-breaker = Score Differential $(\text{Team Score} - \text{Opponent Score})$.

- **Tournament Series (Best of 3 / Best of 5)**:
  - Series Winner is the team winning $\lceil N/2 \rceil$ matches.
  - Bracket advancement is binary: Winner advances to next node; Loser enters lower bracket (if double elimination) or is eliminated.

---

### 4. Implementation Invariants
1. **Integer Arithmetic**: All scores are calculated and stored in integer point units (`INTEGER` type in PostgreSQL). Fractional or floating-point scores are strictly prohibited.
2. **Immutable Snapshot**: When a tournament is created, the active `scoring_schema_version` is copied into the tournament configuration row. If platform schemas are later updated, existing tournaments preserve their original scoring rule snapshot.
3. **Automated Verification**: Before match results are finalized, the scoring engine verifies:
   - Sum of placement points matches the expected total for the lobby size.
   - Total recorded kills does not exceed the maximum possible in-game combatants.

## Consequences
- 100% deterministic calculation of standings.
- Eliminates participant disputes over tie-breaking or point calculation errors.
- Fully compatible with automated result ingestion via official publisher APIs when available.
