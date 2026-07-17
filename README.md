# Group TCG Server

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Sqwiglyy/groupman-tcg-server)

Private Cloudflare Worker and D1 template for the
[Group TCG RuneLite plugin](https://github.com/Sqwiglyy/groupman-tcg). It stores
approved server membership, shared and personal TCG collections, missed pack
reveals, and consent-based Top Trumps events.

There is no public default deployment. One Worker is claimed by one private
group, and every member of that group must configure the same Worker root URL.
Any RuneScape account type can join; GIM and RuneLite Party are not required.

## Stored data and privacy

D1 stores:

- the RuneScape display name supplied by each joining player;
- random group/member IDs, server labels, role, approval state, and whether
  the player selected a shared or solo collection;
- SHA-256 hashes of Group TCG bearer tokens and invite codes;
- opaque hashes of OSRS TCG source-instance IDs;
- card names, foil/debug flags, pull timestamps, grow-only shared unlocks,
  pack contents, and Top Trumps events.

The API does not accept Jagex passwords, Jagex account emails, game-session
tokens, account IDs, bank PINs, inventory, bank, equipment, stats, XP, world,
location, clan data, or chat. Raw original-puller names and raw OSRS TCG
instance IDs are not stored.

Bearer tokens, invite codes, and the initial setup key necessarily arrive over
HTTPS when used. Only bearer/invite hashes are stored in D1; the setup key is
an encrypted Worker secret and is never written to D1.

The Worker deliberately avoids logging request bodies, authorization values,
display names, identifiers, and gameplay data. Cloudflare still processes
normal connection metadata such as IP addresses. The Cloudflare account owner
can access D1 and backups and is responsible for access, retention, privacy,
and deletion.

## Security model

- An encrypted `SETUP_KEY` protects the first group creation.
- The first successful creation permanently claims the Worker's one group
  slot.
- Each joining player gets a separate token and remains pending until approved.
- The owner sees the submitted RuneScape display name and approves or rejects
  that membership.
- Only the owner can approve, revoke, or rotate 30-day invites.
- Revocation invalidates that member's API access.
- A deployment accepts up to 50 active memberships.
- Top Trumps events are visible only to the two participating authenticated
  members.

This remains an honour-mode service. A display name helps trusted friends
identify each other but does not cryptographically prove character ownership.

## One-click Cloudflare deployment

1. Click **Deploy to Cloudflare** above.
2. Sign into Cloudflare and GitHub when asked.
3. Accept the generated Worker and D1 names. The deployment command applies
   every pending migration before deploying.
4. Generate a unique setup key of at least 16 characters; 32+ random
   characters is recommended. Save it in a password manager.
5. In the Worker's Cloudflare settings, add an encrypted secret named exactly
   `SETUP_KEY`, then deploy the secret change. Never put its value in this
   repository, screenshots, chat, or an invite.
6. Open `https://YOUR-WORKER.workers.dev/health` and confirm a response like:

   ```json
   {"status":"ok","service":"group-tcg-api","version":4,"setupReady":true}
   ```

7. Copy the root `https://YOUR-WORKER.workers.dev` URL without `/health`.
8. In RuneLite, every player enables **Connect to server** in **Group TCG** and
   enters that exact root under **Server URL**.
9. The owner logs into their character, selects **Create private group**, and
   enters the setup key once.
10. The owner privately shares the group ID and invite code—not the setup key.
11. Friends log into their characters and select **Join private group**. The
    owner verifies the displayed RuneScape names and approves them.

Never publish the group ID/invite pair or a bearer token.

## Manual deployment

Requires a Cloudflare account, Node.js 22+, and pnpm:

```powershell
pnpm install
pnpm wrangler login
pnpm wrangler d1 create groupman-tcg --binding DB --update-config
pnpm wrangler secret put SETUP_KEY
pnpm check
pnpm deploy
```

The D1 creation command writes a deployment-specific database ID into
`wrangler.jsonc`. Remove that ID before publishing a reusable fork. This
template intentionally contains no account ID, database ID, server URL, setup
key, invite, or token.

If production-specific D1 configuration is kept in the ignored
`wrangler.local.jsonc`, use:

```powershell
pnpm install
pnpm check
pnpm deploy:production
```

Both deployment commands run migrations first.

## Updating an existing API v3 deployment

API v4 migrations add the explicitly disclosed display name, per-member
collection mode, and Top Trumps event tables.

1. Ask players to close RuneLite or temporarily disable **Connect to server**.
2. Export a private D1 backup.
3. Update the repository and run `pnpm install` and `pnpm check`.
4. Run `pnpm deploy` or `pnpm deploy:production`.
5. Confirm `/health` reports version 4.
6. Install the matching Group TCG plugin build.
7. Existing members created under the identity-free API may have a blank
   display name. Because the old token is locally tied to the prior character,
   the cleanest upgrade is to disconnect, revoke the old membership, and join
   again so the name and collection mode are registered.

Do not deploy only one half of this protocol change for gameplay testing.

## Updates and backups

Before every update:

```powershell
pnpm install
pnpm check
pnpm wrangler d1 export DB --remote --output group-tcg-backup.sql
pnpm deploy
```

For `wrangler.local.jsonc`, add `--config wrangler.local.jsonc` to the export
command and use `pnpm deploy:production`.

Keep exports outside public repositories and shared folders. Never commit
`.dev.vars`, `.env`, bearer tokens, invites, D1 IDs, setup keys, logs, or
exports. Deleting the Worker does not necessarily delete D1; when retiring a
server, delete the Worker, D1 database, and private exports separately.

Revoking a member stops future access but deliberately leaves grow-only shared
unlocks and history. Removing stored history or a display name requires the
operator to delete the relevant D1 rows or retire the deployment.

## Troubleshooting

- **`/health` has a database error:** run `pnpm db:migrate:remote`, or use
  `pnpm db:migrate:production` with `wrangler.local.jsonc`.
- **`setupReady:false`:** add the encrypted `SETUP_KEY` secret and redeploy.
- **`invalid_setup_key`:** the owner entered a different setup-key value.
- **`instance_claimed`:** this Worker already owns a group; use its existing
  invite or deploy another Worker.
- **A member remains pending:** confirm their displayed RuneScape name and
  approve it from the owner sidebar.
- **`player_already_joined`:** revoke/remove the old active membership or use
  the existing profile token.
- **Top Trumps reports insufficient cards:** both players need at least one
  uploaded card in the collection mode each selected.
- **A URL is rejected:** use an HTTPS root URL with no path, query, credentials,
  or fragment. Plain HTTP is accepted only on localhost.
- **A teammate cannot sync:** confirm the exact same Worker URL, approval state,
  plugin/API version, and unexpired invite.

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

Authenticated routes use `Authorization: Bearer MEMBER_TOKEN`.

- `POST /v1/groups` creates the deployment's group and includes `playerName`
  and `collectionMode`; it also requires `X-Groupman-Setup-Key`.
- `POST /v1/join` requests membership with group ID, invite, display name, and
  collection mode.
- `GET /v1/groups/{groupId}` returns membership and approval state.
- `POST|DELETE /v1/groups/{groupId}/members/{memberId}` approves or revokes.
- `POST /v1/groups/{groupId}/invite` rotates the invite.
- `POST /v1/groups/{groupId}/packs` stores retry-safe pack events.
- `POST /v1/groups/{groupId}/member-collection` uploads personal card copies
  and the current solo/shared mode.
- `GET /v1/groups/{groupId}/member-collections` and member collection routes
  provide approved-member provenance.
- `GET /v1/groups/{groupId}/sync` returns missed packs, collection changes, and
  participant-scoped Top Trumps events.
- `POST /v1/groups/{groupId}/top-trumps/challenges` creates a consent request.
- `POST /v1/groups/{groupId}/top-trumps/challenges/{id}/response` accepts or
  declines; on acceptance the server draws from each player's selected mode.

Run before every deployment:

```powershell
pnpm check
pnpm wrangler deploy --dry-run --outdir dist
```

Report security issues privately using [SECURITY.md](SECURITY.md).
