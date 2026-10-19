# Vexora Container Security, Image Signing & SBOM Architecture

**Standard**: NIST SP 800-218 (Secure Software Development Framework) & Executive Order 14028  
**Blueprint Ref**: Section 45 (CI/CD Pipeline: Sign images + SBOM, canary deploy)  

---

## 1. Container Hardening Specifications
All production container images (`vexora-backend`, `vexora-web`, `vexora-admin`) are built upon minimal hardened base images (`cgr.dev/chainguard/node:latest` or `distroless/nodejs20-debian12`):
- **Non-Root Execution**: Runs as unprivileged UID `10001:10001`.
- **Read-Only Root Filesystem**: `readOnlyRootFilesystem: true` enabled in Kubernetes/ECS task definitions; `/tmp` mounted as in-memory `emptyDir`.
- **Zero Package Managers**: Build tools (`npm`, `apk`, `curl`) removed from production runtime layers.
- **Drop All Capabilities**: `capabilities.drop: ["ALL"]`.

---

## 2. Software Bill of Materials (SBOM) Generation
Every CI pipeline build generates a machine-readable Software Bill of Materials in **CycloneDX JSON** and **SPDX** formats using `syft`:
```bash
syft packages dir:. -o cyclonedx-json=sbom.cyclonedx.json
```
The SBOM contains:
- Cryptographic SHA-256 hashes of all npm production dependencies.
- OpenSSL and runtime OS shared library fingerprints.
- License compliance declarations (verifying MIT, Apache-2.0, BSD-3; blocking GPLv3).

---

## 3. Cryptographic Image Signing with Cosign
Images pushed to the private container registry are signed using Sigstore Cosign:
```bash
cosign sign --key kms://arn:aws:kms:ap-south-1:xxx:key/vexora-cosign-key \
  ghcr.io/vexora/vexora-backend:${IMAGE_TAG}
```
The image signature and attached SBOM attestations are verified by the Kubernetes admission controller (Kyverno) before any pod scheduling is permitted on production nodes.
