# GitHub Repository Branch Protection & Governance Specifications

## 1. Protected Branch: `main`
In accordance with **Vexora Complete Project Blueprint Section 38** and **PHASE.md Phase 2**, the `main` branch is protected with strict governance rules.

### Rule Settings Configuration
- **Branch Name Pattern**: `main`
- **Require a pull request before merging**: `true`
  - **Require approvals**: `1` (minimum default)
  - **Dismiss stale pull request approvals when new commits are pushed**: `true`
  - **Require review from Code Owners**: `true` (enforced via `.github/CODEOWNERS`)
  - **Require approval of the most recent push**: `true`
- **Require status checks to pass before merging**: `true`
  - **Require branches to be up to date before merging**: `true`
  - **Mandatory Status Checks**:
    - `ci/lint-and-typecheck`
    - `ci/unit-tests`
    - `ci/secret-scan`
    - `ci/build`
- **Require conversation resolution before merging**: `true`
- **Require signed commits**: `true` (GPG/SSH signed)
- **Require linear history**: `true` (Squash and merge or rebase merge)
- **Do not allow bypassing the above settings**: `true` (enforced for administrators)
- **Restrict who can push to matching branches**: `Only release automation service accounts`
- **Allow force pushes**: `false` (Strictly prohibited)
- **Allow deletions**: `false` (Strictly prohibited)

---

## 2. Sensitive Module Multi-Party Review Requirements
Enforced via `.github/CODEOWNERS`:
1. **Wallet & Financial Ledger** (`/backend/src/wallet/`, `/backend/src/payouts/`, `/backend/src/redeem/`):
   - Mandatory 2-reviewer sign-off including financial security owner.
2. **Auth & Identity** (`/backend/src/auth/`):
   - Mandatory 2-reviewer sign-off including identity security lead.
3. **Admin Console & Privileged APIs** (`/backend/src/admin/`, `/apps/admin/`):
   - Mandatory 2-reviewer sign-off.
4. **Audit Log & Tamper-Evident Chain** (`/backend/src/audit/`):
   - Mandatory 2-reviewer sign-off.
