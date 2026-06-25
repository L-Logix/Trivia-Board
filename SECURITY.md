# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

This project is a local broadcast tool designed to run on trusted private networks. It does not handle user authentication, payment data, or PII by design.

If you discover a security vulnerability, please report it privately:

1. **Do not** open a public GitHub issue
2. Email the details to the maintainer or open a draft [GitHub Security Advisory](https://github.com/L-Logix/Trivia-Board/security/advisories)
3. Include a description of the vulnerability, steps to reproduce, and potential impact

You should receive a response within **7 days**. If the issue is confirmed, a fix will be prioritized and released as a patch.

## Scope

The following are **in scope**:
- Remote code execution via socket events
- Unauthorized game state manipulation
- Cross-site scripting (XSS) in the dashboard or broadcast views
- Path traversal in asset file serving

The following are **out of scope**:
- Physical security of the host machine
- Network-level attacks (the engine assumes a trusted LAN)
- Social engineering of the host

## Safe Defaults

- The server binds to `0.0.0.0` by default — restrict access via firewall if running on untrusted networks
- All game control happens through Socket.IO — no REST API for state mutations
- Asset files are served from `public/` only

## Responsible Disclosure

We ask that you give us reasonable time to fix a vulnerability before disclosing it publicly. We will credit you in the release notes if you are the first to report a confirmed issue.
