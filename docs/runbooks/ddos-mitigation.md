# Distributed Denial of Service (DDoS) Mitigation Runbook

**Severity**: SEV-1 (Critical during major tournament finals) / SEV-2 (Normal hours)  
**Owners**: Network Security Engineer, Cloud Architect  

---

## 1. Trigger Conditions
- API gateway request volume surges > 10x baseline with abnormal origin distribution.
- High volume of Layer 7 HTTP floods hitting `/auth/login`, `/tournaments/register`, or `/wallet`.
- Edge WAF blocks surge past 5,000 blocks/minute.

---

## 2. Escalation & Edge Shield Activation
1. **Enable Cloudflare Under Attack Mode / AWS Shield Advanced**:
   - Turn on Managed Challenge on all non-static asset routes.
2. **Aggressive Bot & Rate Limiting Thresholds**:
   - Lower IP rate limit from 100 req/min to 20 req/min for mutating routes.
   - Restrict incoming requests to valid mobile client signatures and App Check tokens.
3. **Protect Critical Financial & Tournament Endpoints**:
   - Apply strict WAF rate-limiting rules on `/api/v1/tournaments/*/register` and `/api/v1/wallet/*`.
   - Shed low-priority traffic: disable public search suggestions, static previews, and heavy historical leaderboard aggregations.

---

## 3. Post-Attack Analysis
- Extract top attacking autonomous system numbers (ASNs) and CIDR blocks.
- Add persistent block rules to Edge WAF firewall rules.
- Review infrastructure auto-scaling metrics and compute costs.
