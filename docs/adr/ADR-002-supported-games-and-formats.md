# ADR-002: Supported Games, Formats, and Scoring Engine Schemas

## Status
Accepted

## Context (Blueprint Section 31, Questions 2, 3 & 14)
Vexora needs a modular, non-hardcoded rules and scoring engine. We need to support diverse competitive esports titles with completely different win conditions, point structures, and bracket formats.

## Decision
1. **Launch Games Supported**:
   - **Garena Free Fire**: Battle Royale (Solo, Duo, Squad). Scoring: Placement points (1st: 12pts, 2nd: 9pts, 3rd: 8pts... 10th: 1pt) + 1 point per kill.
   - **BGMI (Battlegrounds Mobile India)**: Battle Royale (Squad 4v4). Scoring: Official Krafton points table (1st: 10pts, 2nd: 6pts, 3rd: 5pts... 8th: 1pt) + 1 point per kill.
   - **Call of Duty Mobile**: Search & Destroy and Hardpoint (5v5 knockout brackets). Scoring: Round wins + KD ratio tie-breakers.
2. **Supported Tournament Formats**:
   - Single Elimination Knockout (powers of 2 brackets with byes and seeding).
   - Round-Robin / Swiss groups for qualifying rounds.
   - Battle Royale multi-team lobby grouping (up to 25 squads per lobby, 100 players total).
3. **Versioned Scoring Formula Engine**:
   - Each game mode scoring configuration is defined as a JSON schema with a semantic version number (e.g., `bgmi_br_v1.0.0`).
   - Formulas are validated before tournament registration opens and executed deterministically on server and client.
   - Live tournament scoring formulas cannot be changed silently; emergency modifications produce an audited new version.

## Consequences
- Clean separation between core tournament state and game-specific scoring mathematics.
- Any game publisher rule changes can be accommodated with a new scoring version schema without modifying application code.
