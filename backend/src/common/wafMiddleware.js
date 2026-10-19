import { logger } from './logger.js';

/**
 * Phase 36: Security Hardening — Edge WAF & Bot Management Middleware
 * Blueprint Ref: Section 47 (Layered Defence: Edge CDN/WAF with managed rules & bot management)
 */

// Known automated malicious vulnerability scanner User-Agents
const KNOWN_ATTACK_TOOLS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /dirbuster/i,
  /nessus/i,
  /masscan/i,
  /zgrab/i,
  /wpscan/i,
  /burpcollaborator/i,
];

// SQL Injection attack signatures
const SQLI_PATTERNS = [
  /(\bunion\b\s+select\b)/i,
  /(\bor\b\s+['"]?1['"]?\s*=\s*['"]?1['"]?)/i,
  /(\band\b\s+['"]?1['"]?\s*=\s*['"]?1['"]?)/i,
  /(;\s*drop\s+table\b)/i,
  /(;\s*truncate\s+table\b)/i,
  /(\bpg_sleep\s*\()/i,
  /(\bwaitfor\s+delay\b)/i,
  /(;\s*exec\s*\()/i,
  /('--\s*$)/m,
];

// Cross-Site Scripting (XSS) signatures
const XSS_PATTERNS = [
  /<script\b[^>]*>/i,
  /<\/script>/i,
  /javascript:\s*/i,
  /data:text\/html/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
  /\bonclick\s*=/i,
  /\balert\s*\(/i,
];

// Path Traversal signatures
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /%2e%2e%5c/i,
  /\/etc\/passwd/i,
  /c:\\windows\\system32/i,
];

/**
 * Recursively inspect values for malicious patterns
 */
function inspectValue(val) {
  if (val === null || val === undefined) return null;

  if (typeof val === 'string') {
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(val)) return { category: 'SQL_INJECTION', signature: pattern.toString() };
    }
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(val)) return { category: 'XSS_ATTACK', signature: pattern.toString() };
    }
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(val)) return { category: 'PATH_TRAVERSAL', signature: pattern.toString() };
    }
    return null;
  }

  if (Array.isArray(val)) {
    for (const item of val) {
      const violation = inspectValue(item);
      if (violation) return violation;
    }
    return null;
  }

  if (typeof val === 'object') {
    const proto = Object.getPrototypeOf(val);
    if (
      proto !== null &&
      proto !== Object.prototype &&
      !(val instanceof Date) &&
      !(val instanceof RegExp) &&
      !(val instanceof Buffer)
    ) {
      return { category: 'PROTOTYPE_POLLUTION', signature: '__proto__' };
    }

    for (const key of Object.getOwnPropertyNames(val)) {
      // Check keys for path traversal or prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return { category: 'PROTOTYPE_POLLUTION', signature: key };
      }
      const violation = inspectValue(val[key]);
      if (violation) return violation;
    }
  }

  return null;
}

/**
 * Check if request user agent matches known automated scanners
 */
export function isAutomatedScanner(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  return KNOWN_ATTACK_TOOLS.some(toolRegex => toolRegex.test(userAgent));
}

/**
 * Check whether any payload string contains malicious exploits
 */
export function isMaliciousPayload(payload) {
  return inspectValue(payload);
}

/**
 * Express Middleware: Inspects headers, query params, URL, and body
 */
export function wafMiddleware(req, res, next) {
  const userAgent = req.get('user-agent') || '';

  // 1. Bot & Scanner Detection
  if (isAutomatedScanner(userAgent)) {
    logger.warn('WAF: Blocked automated scanner/exploit tool probe', {
      ip: req.ip,
      userAgent,
      path: req.originalUrl,
      correlationId: req.correlationId,
    });
    return res.status(403).json({
      error: {
        code: 'WAF_BOT_BLOCKED',
        message: 'Access denied by WAF security policies (automated vulnerability scanner detected).',
      },
    });
  }

  // 2. Path & Query Inspection
  const pathViolation = inspectValue(req.originalUrl);
  if (pathViolation) {
    logger.warn('WAF: Blocked malicious URL request', {
      ip: req.ip,
      path: req.originalUrl,
      category: pathViolation.category,
      correlationId: req.correlationId,
    });
    return res.status(403).json({
      error: {
        code: 'WAF_PAYLOAD_BLOCKED',
        message: `Request blocked by Web Application Firewall (${pathViolation.category}).`,
      },
    });
  }

  // 3. Body Inspection (for mutating methods POST, PUT, PATCH)
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const bodyViolation = inspectValue(req.body);
    if (bodyViolation) {
      logger.warn('WAF: Blocked malicious body payload', {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        category: bodyViolation.category,
        correlationId: req.correlationId,
      });
      return res.status(403).json({
        error: {
          code: 'WAF_PAYLOAD_BLOCKED',
          message: `Request blocked by Web Application Firewall (${bodyViolation.category}).`,
        },
      });
    }
  }

  req.wafClean = true;
  next();
}
