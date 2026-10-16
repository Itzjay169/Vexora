# Changelog: @vexora/scoring-engine

All notable changes to the Vexora Deterministic Game Scoring Engine will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - Phase 20: Reproducible Scoring & Leaderboards
### Added
- **Preview Helper**: `previewScore(gameSlug, formula, rawStats)` for client-side instant preview in Flutter mobile and Next.js web apps.
- **Standings SHA-256 Digest**: `computeStandingsDigest(standings)` for tamper-evident leaderboard snapshots and Merkle root verification.
- **Reproducibility Verifier**: `reproduceMatchScore(formula, rawStats)` providing cryptographic verification that scores can be recalculated identically from raw inputs.
- **Strict Integer Arithmetic Enforcement**: Runtime invariant validation preventing any floating point leaks in points computation.
- **Enhanced Standings Tie-Breaking**: Deterministic resolution supporting multi-match series and secondary tie-breakers across BGMI, Free Fire MAX, and CODM.

## [1.0.0] - Phase 11: Configurable Game Engine & Formulas
### Added
- Initial release of `@vexora/scoring-engine`.
- Official BGMI Krafton 10-point system and 1 pt/kill placement tables.
- Official Garena Free Fire Standard Booyah 12-point system and 1 pt/kill placement tables.
- Official CODM Search & Destroy / Hardpoint match victory formulas.
- Dynamic `calculateFormulaScore` supporting custom versioned JSON schemas.
- Deterministic multi-stage tie-breaking engine (`sortStandings`).
- Invariant verifiers: `verifyLobbyPlacementPoints` and `verifyCombatantKillCount`.
- Organiser simulation utility: `simulateTournamentScoring`.
