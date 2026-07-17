# Changelog

## v0.1.0-rc.2 - 2026-07-17

- Require a private encrypted `SETUP_KEY` before an unclaimed Worker can create
  its single group.
- Report setup readiness without disclosing the key through API v3 health
  responses.
- Document one-time owner setup, key rotation, and first-claim troubleshooting.

## v0.1.0-rc.1 - 2026-07-17

- Added the private, self-hosted Cloudflare Worker and D1 API for Groupman TCG.
- Limited each deployment to one group with five active members.
- Replaced RuneScape identity with generated `Owner` and `Member XXXXXX`
  labels throughout the API.
- Replaced raw OSRS TCG instance IDs with opaque client-generated identifiers.
- Removed original-puller values and the legacy identity-shaped database
  columns through migrations 0003 and 0004.
- Disabled Worker observability in the reusable template and production config.
- Added automatic migrations, a one-click deployment path, CI, privacy guards,
  backup guidance, troubleshooting, and private security-reporting instructions.
- Declared Node.js 22 as the minimum supported deployment runtime required by
  the pinned Wrangler release.
