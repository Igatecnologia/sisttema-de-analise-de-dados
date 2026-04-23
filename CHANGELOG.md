# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Global tab navigation with persistence per tenant.
- Sprint 1 hardening: cookie-first auth, encryption at rest, CSP, rate limits, and client error telemetry.
- Sprint 2 baseline: reusable skeletons, Playwright retries + report artifact, architecture documentation, and changelog automation script.

### Changed
- Finance export now loads PDF libraries on demand to reduce initial bundle cost.
- CI now caches Playwright browser binaries for faster e2e runs.
