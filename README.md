# Groupman TCG Server

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Sqwiglyy/groupman-tcg-server)

Private Cloudflare Worker and D1 template for the
[Groupman TCG RuneLite plugin](https://github.com/Sqwiglyy/groupman-tcg). It
keeps shared TCG unlocks, per-member card history, and missed pack reveals
available while teammates are offline.

There is no public default deployment. Each Worker intentionally accepts one
private group of up to five active members, and every member of that group must
use the same Worker root URL.

## Privacy design

The API does not accept or return RuneScape names, GIM names or rosters,
account IDs, stats or XP, inventory, bank or equipment contents, world,
location, clan data, chat, Jagex credentials, bank PINs, or game-session
tokens.

D1 stores only:

- random group/member IDs and server-generated labels such as `Owner` and
  `Member A1B2C3`;
- SHA-256 hashes of Groupman TCG bearer tokens and invite codes;
- opaque hashes of source card-instance IDs;
- card names, foil/debug flags, pull timestamps, shared unlocks, and pack
  contents;
- membership role/status and service timestamps.

Bearer tokens and invite codes necessarily arrive over HTTPS when used, but
their plaintext values are not written to D1. The Worker deliberately does not
log request bodies, credentials, identifiers, IP addresses, or gameplay data,
and Worker observability is not enabled by the template. Cloudflare still
processes connection metadata such as IP addresses at its edge under the
self-hosting account's settings and policies.

The private setup key is received only in the first group-creation request. It
is configured as an encrypted Cloudflare Worker secret, is never written to
D1, and is never stored by the RuneLite plugin. Group members do not need it.

Migration `0003_private_members.sql` irreversibly replaces any legacy
RuneScape/original-puller labels in an existing D1 database with private member
labels and blank values. Back up the database before updating if the operator
needs an archive, then keep that archive private or delete it after confirming
the migration.

## Security model

- A private encrypted setup key protects the first group creation. The first
  successful creation then permanently claims the deployment's single group
  slot, so another group cannot register on that Worker.
- The owner receives an individual bearer token and a 30-day invite code.
- A joining client receives a separate token and remains pending.
- The owner confirms the joining member's private label out of band, then
  approves or rejects it.
- Only the owner can approve, revoke, or rotate invites.
- Revocation immediately invalidates that membership's API access.
- A group is capped at five active memberships.
- Existing bearer tokens are bound client-side to the Worker that issued them.

This is an honour-mode coordination service. It does not attempt to prove
ownership of an in-game character because no RuneScape identity is uploaded.

## Launch a new private group

### One-click Cloudflare deployment

1. Click **Deploy to Cloudflare** above.
2. Sign into Cloudflare and GitHub when asked.
3. Accept the generated Worker and D1 names and wait for the deployment build.
   The `pnpm deploy` command applies every pending migration before deploying.
4. Generate a unique random setup key of at least 16 characters (32 or more is
   recommended) and save it privately in a password manager. In the Worker's
   Cloudflare settings, add an **encrypted secret** named exactly `SETUP_KEY`
   with that value, then deploy the secret change. Never put the value in
   `wrangler.jsonc`, GitHub, chat, screenshots, or the invite message.
5. Open `https://YOUR-WORKER.workers.dev/health` and confirm a response similar
   to `{"status":"ok","service":"groupman-tcg-api","version":3,"setupReady":true}`.
6. Copy only the root `https://YOUR-WORKER.workers.dev` URL.
7. Every teammate opens RuneLite settings for **Groupman TCG**, enables
   **Hosted offline sync**, and pastes that identical root URL into
   **Hosted server URL**.
8. The owner logs into their GIM/HCGIM character, selects **Create hosted
   group** in the plugin sidebar, and enters the setup key once. The plugin
   sends it only to that Worker over HTTPS and does not save it.
9. The owner privately shares the displayed group ID and invite code, not the
   setup key.
10. Each teammate selects **Join hosted group**, then tells the owner their
   assigned private label such as `Member A1B2C3`.
11. The owner approves only the expected label. Repeat for the remaining team.

Never publish the group ID/invite pair. Never share an owner/member bearer
token. The RuneLite plugin stores its token in the associated local RuneLite
profile and does not display it.

### Manual deployment

Requires a Cloudflare account, Node.js 22 or newer, and pnpm:

```powershell
pnpm install
pnpm wrangler login
pnpm wrangler d1 create groupman-tcg --binding DB --update-config
pnpm wrangler secret put SETUP_KEY
pnpm check
pnpm deploy
```

At the `secret put` prompt, enter a unique random value of at least 16
characters. Wrangler stores it as an encrypted Worker secret; do not add it to
the repository. Save it privately until the owner has created the group. Other
members never need it.

The D1 creation command writes that deployment's database ID into
`wrangler.jsonc`. Remove that account-specific ID before publishing a reusable
fork. This repository's tracked template contains no account or database ID.
`pnpm deploy` runs remote migrations before deploying the Worker.

For an existing deployment whose account-specific D1 configuration is kept in
the ignored `wrangler.local.jsonc`, use:

```powershell
pnpm install
pnpm check
pnpm deploy:production
```

That command also applies migrations first.

### Upgrade an existing deployment

The v2 protocol removed fields that older plugin builds expected. API v3 adds
setup-key protection for unclaimed Workers without changing established member
sync. Coordinate an update rather than deploying it mid-session:

1. Update every teammate to the matching Groupman TCG privacy build.
2. Ask the group to close RuneLite or disable hosted sync temporarily.
3. Export a private D1 backup.
4. If this Worker has not created its group yet, configure the encrypted
   `SETUP_KEY` secret before continuing. An already claimed Worker does not
   require the key for normal group operations.
5. Run `pnpm check`, then `pnpm deploy` or `pnpm deploy:production`.
6. Confirm `/health` reports version `3` and allow each client to sync again.
7. Confirm members now appear only as `Owner` or `Member XXXXXX`.

Migration 0003 redacts legacy RuneScape and original-puller labels. That
redaction is intentional and cannot be reversed without restoring the private
backup.

## Updates and backups

Before every update:

```powershell
pnpm install
pnpm check
pnpm wrangler d1 export DB --remote --output groupman-tcg-backup.sql
pnpm deploy
```

For `wrangler.local.jsonc`, add `--config wrangler.local.jsonc` to the export
command and use `pnpm deploy:production`.

Cloudflare retains D1 independently of Worker code. Deleting the Worker does
not necessarily delete D1. When retiring a group, delete both resources and
any private exports. Never commit `.dev.vars`, `.env`, bearer tokens, invite
codes, D1 database IDs, setup keys, logs, or exported data. Encrypted Worker
secrets persist separately from code deployments; rotate `SETUP_KEY` with
`wrangler secret put` if it is exposed before the Worker is claimed.

## Privacy requests and deletion

The self-hosting Cloudflare account owner controls the database and is
responsible for retention, backups, access, applicable privacy notices, and
deletion requests. To remove everything, export any required private backup,
then delete the Worker, D1 database, and all exports from the Cloudflare
account and local machines.

Revoking a member stops access but deliberately leaves grow-only group unlocks
and existing history. Removing a member's stored history requires an operator
to delete their D1 rows directly or retire the whole private deployment.

## Troubleshooting

- **`/health` returns a database error:** run `pnpm db:migrate:remote`, or
  `pnpm db:migrate:production` when using `wrangler.local.jsonc`.
- **`/health` shows `setupReady:false`:** add an encrypted Worker secret named
  exactly `SETUP_KEY` with a random value of at least 16 characters, deploy the
  secret change, and refresh `/health`.
- **Create says `setup_not_configured`:** the Worker has no valid setup secret;
  configure `SETUP_KEY` and try again.
- **Create says `invalid_setup_key`:** the owner entered a different value from
  the Worker's `SETUP_KEY`. Re-enter the saved key; do not send it to members.
- **The Worker says `instance_claimed`:** this deployment already belongs to a
  group. Use its existing owner/invite flow or deploy a separate Worker.
- **A member remains pending:** confirm their private `Member XXXXXX` label
  through a trusted channel, then approve that label in the owner's sidebar.
- **One teammate cannot join:** confirm everyone uses the identical HTTPS root
  URL and that the invite has not expired.
- **The plugin rejects the URL:** use `https://...workers.dev` without
  `/health`, other paths, query parameters, credentials, or fragments. Plain
  HTTP is accepted only for localhost development.
- **The `DB` binding is missing:** rerun
  `pnpm wrangler d1 create groupman-tcg --binding DB --update-config` and deploy.
- **An update fails:** keep the backup, run `pnpm check`, inspect Cloudflare's
  deployment result, and do not repeatedly apply manual SQL. Wrangler tracks
  completed migrations.
- **Changing Worker URL did not move the group:** groups are not copied between
  D1 databases. Clients must disconnect and create/join on the new deployment.

## Local development

```powershell
pnpm install
pnpm db:migrate:local
pnpm check
pnpm dev
```

Then open `http://localhost:8787/health`. Local HTTP is accepted only for
loopback development.

## API summary

Every response is JSON. Authenticated routes require:

```http
Authorization: Bearer MEMBER_TOKEN
```

### Create and join

Create the deployment's one group:

```http
POST /v1/groups
Content-Type: application/json
X-Groupman-Setup-Key: PRIVATE_SETUP_KEY

{}
```

This header is required only for the first group creation. The Worker rejects
creation when the encrypted `SETUP_KEY` secret is missing or does not match,
and rejects further creation attempts after its group slot is claimed.

Request a pending membership without a RuneScape identity:

```http
POST /v1/join
Content-Type: application/json

{
  "groupId": "GROUP_UUID",
  "inviteCode": "ABCD-EFGH-JK23"
}
```

Responses identify members only by generated private `label` values.

### Membership

- `GET /v1/groups/{groupId}` lists private member labels and status.
- `POST /v1/groups/{groupId}/members/{memberId}` approves a member (owner).
- `DELETE /v1/groups/{groupId}/members/{memberId}` revokes a member (owner).
- `POST /v1/groups/{groupId}/invite` rotates the invite (owner).

### Packs and collections

- `POST /v1/groups/{groupId}/packs` uploads a retry-safe event ID, timestamp,
  and 1-10 card name/foil/new records.
- `POST /v1/groups/{groupId}/member-collection` uploads up to 200 card copies
  per chunk. Each copy contains an opaque source ID, card name, foil/debug flag,
  and pull time; it never contains an original-puller name.
- `GET /v1/groups/{groupId}/member-collections` returns totals by private
  member label.
- `GET /v1/groups/{groupId}/members/{memberId}/collection` returns paginated
  private collection history.
- `GET /v1/groups/{groupId}/provenance?cardName=...` returns current copies by
  private member label.
- `GET /v1/groups/{groupId}/sync?after=0&collectionVersion=0&limit=100` returns
  missed pack activity and the grow-only unlock union when its version changed.

Example collection instance:

```json
{
  "sourceInstanceId": "i_OPAQUE_SHA256_VALUE",
  "cardName": "Great Olm",
  "foil": true,
  "debug": false,
  "pulledAt": 1784296800000
}
```

## Verification

Run before every deployment:

```powershell
pnpm check
pnpm wrangler deploy --dry-run --outdir dist
```

The source is TypeScript for Cloudflare only; the RuneLite Plugin Hub artifact
remains Java-only and does not bundle or execute this server code.

Report security or privacy problems privately using the instructions in
[SECURITY.md](SECURITY.md). Never include deployment credentials or database
exports in a public issue.
