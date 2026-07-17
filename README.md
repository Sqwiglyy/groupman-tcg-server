# Groupman TCG Server

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Sqwiglyy/groupman-tcg-server)

Cloudflare Worker and D1 database used by the Groupman TCG RuneLite plugin for
durable group unlocks and offline pack history. RuneLite Party can still carry
instant reveals; this API makes every approved member converge after reconnecting.

Production API: `https://groupman-tcg-api.sqwiglyy.workers.dev`

The RuneLite plugin uses that public service by default. A group may instead
deploy this repository to one teammate's Cloudflare account and enter the
resulting Worker URL in **Hosted server URL**. Every member of a group must use
the same server; groups and credentials do not cross between deployments.

## Security model

- A group owner creates a group and receives an owner token plus a 30-day invite.
- New members join as pending and receive an individual token.
- Only the owner can approve or revoke members.
- Hosted groups are capped at the five members supported by Group Ironman.
- Tokens and invite codes are stored in D1 only as SHA-256 hashes.
- The RuneLite client must never contain a shared administrative secret.
- This is an honour-mode service. It cannot prove ownership of a RuneScape name.

Keep member tokens private. They are returned only when a group is created or a
member joins. A revoked member can rejoin with a valid invite and receives a new
token, but must be approved again.

## Data and operator responsibilities

Each deployment stores group/member IDs, RuneScape display names, hashed bearer
tokens and invite codes, card instance IDs and names, foil/original-puller/time
metadata, shared unlocks, and pack events. It does not receive Jagex passwords,
bank PINs, session tokens, chat, or general gameplay telemetry from the plugin.
The application does not deliberately store client IP addresses, although
Cloudflare may process connection metadata under the account's Cloudflare
settings and policies.

Data currently remains in D1 until the server operator removes it or deletes
the database. A self-hosting operator is responsible for access to the
Cloudflare account, backups, applicable privacy notices, and responding to
their group's deletion requests. The API is an honour-mode coordination service
and cannot independently prove that a RuneScape display name belongs to the
caller.

## Deploy your own Cloudflare server

This repository is a reusable Worker + D1 template. The checked-in
`wrangler.jsonc` deliberately contains no Sqwiglyy account or database ID.
Cloudflare creates a separate database in the deploying user's account.

### One-click template

Click the **Deploy to Cloudflare** button at the top of this README. Cloudflare
will clone this public repository, provision the Worker and D1 binding, apply
the migrations through `pnpm deploy`, and deploy it.

The group owner then:

1. Clicks **Deploy to Cloudflare** and signs into Cloudflare and GitHub.
2. Accepts the generated Worker and D1 names and waits for the build to finish.
3. Opens `https://THEIR-WORKER.workers.dev/health` and confirms it returns
   `{"status":"ok"}`.
4. Copies the Worker root URL, without `/health`.
5. Every teammate enters that identical URL in RuneLite under
   **Groupman TCG → Collection → Hosted server URL** before creating or joining
   the hosted group.

Never share the owner or member bearer tokens. Teammates share only the group
ID and invite code produced inside the RuneLite sidebar.

### Manual deployment

Requires a Cloudflare account, Node.js 20 or newer, and pnpm.

```powershell
pnpm install
pnpm wrangler login
pnpm wrangler d1 create groupman-tcg --binding DB --update-config
pnpm deploy
```

The D1 command writes the new database ID into that fork's `wrangler.jsonc`.
`pnpm deploy` applies every unapplied migration and then deploys the Worker.
Copy the `https://...workers.dev` URL printed at the end and verify `/health`.

For an existing deployment whose account-specific configuration should remain
uncommitted, copy `wrangler.jsonc` to the ignored `wrangler.local.jsonc`, add
its D1 database ID, and use:

```powershell
pnpm deploy:production
```

### Updates and backups

Before deploying an update, run:

```powershell
pnpm install
pnpm check
pnpm deploy
```

Cloudflare retains D1 data independently of the Worker code. Export a manual
backup before schema changes with:

```powershell
pnpm wrangler d1 export DB --remote --output groupman-tcg-backup.sql
```

Keep exports private: they contain RuneScape display names, card history, and
hashed credentials. Deleting the Worker does not necessarily delete its D1
database; remove both from the Cloudflare dashboard when retiring a server.

### Troubleshooting

- **`/health` works but group actions return database errors:** run
  `pnpm db:migrate:remote`, then deploy again. A new D1 database has no tables
  until both migrations have been applied.
- **Wrangler cannot find the `DB` binding:** confirm `wrangler.jsonc` contains a
  D1 entry whose binding is exactly `DB`. For a manual first deployment, rerun
  `pnpm wrangler d1 create groupman-tcg --binding DB --update-config`.
- **The plugin rejects the server URL:** use the Worker root URL beginning with
  `https://`; do not include `/health`, another path, query parameters, or login
  details. Plain HTTP is accepted only for local development.
- **One teammate cannot join:** every teammate must select the same backend
  before creating or joining. A group ID and invite from one deployment do not
  exist in another deployment.
- **A member remains pending:** the hosted owner must approve that RuneScape
  name, and the plugin will offer approval only when the name is on the official
  in-game Group Ironman roster.
- **Changing the URL does not move an existing group:** disconnect that hosted
  profile, select the new URL, and create or join a group on the new server.
  Collection data is not automatically copied between D1 databases.
- **A deployment build fails:** use Node.js 20 or newer, rerun `pnpm install`
  and `pnpm check`, then inspect live Worker logs with `pnpm wrangler tail`.

## Local development

Requires Node.js 20 or newer.

```powershell
pnpm install
pnpm db:migrate:local
pnpm dev
```

Then open `http://localhost:8787/health`.

Run all local checks with:

```powershell
pnpm check
```

Do not commit `.dev.vars`, `.env`, tokens, invite codes or exported production data.

## API

Every response is JSON. Authenticated routes require:

```http
Authorization: Bearer MEMBER_TOKEN
```

### Create a group

`POST /v1/groups`

```json
{
  "groupName": "Sqwiglyy's HCGIM",
  "ownerRsn": "Sqwiglyy"
}
```

Save the returned owner token immediately. Share the invite code, not the token.

### Request membership

`POST /v1/join`

```json
{
  "groupId": "GROUP_UUID",
  "rsn": "Teammate",
  "inviteCode": "ABCD-EFGH-JK23"
}
```

### Inspect and manage members

- `GET /v1/groups/{groupId}` lists membership.
- `POST /v1/groups/{groupId}/members/{memberId}` approves a member (owner only).
- `DELETE /v1/groups/{groupId}/members/{memberId}` revokes a member (owner only).
- `POST /v1/groups/{groupId}/invite` rotates the invite (owner only).

### Upload a pack

`POST /v1/groups/{groupId}/packs`

```json
{
  "eventId": "client-generated-unique-id",
  "openedAt": 1784296800000,
  "cards": [
    { "name": "Great Olm", "foil": false, "isNew": true }
  ]
}
```

The production client sends every card in the pack. Reusing the same `eventId`
makes retries safe and does not create another pack event.

### Upload historical collection chunks

`POST /v1/groups/{groupId}/collection`

```json
{
  "cardNames": ["Great Olm", "Oak logs"]
}
```

Send no more than 500 names per request. The collection is grow-only.

### Upload an individual collection with provenance

`POST /v1/groups/{groupId}/member-collection`

```json
{
  "snapshotId": "client-snapshot-20260717",
  "complete": true,
  "instances": [
    {
      "sourceInstanceId": "OSRS-TCG-INSTANCE-ID",
      "cardName": "Great Olm",
      "foil": true,
      "pulledBy": "Sqwiglyy",
      "pulledAt": 1784296800000
    }
  ]
}
```

Send at most 200 instances per request. Use one `snapshotId` across all chunks
and set `complete` only on the last chunk. Completing a snapshot removes card
instances no longer owned by that member; it never removes the card from the
shared grow-only unlock collection.

The OSRS TCG data records the current owner separately from the original puller.
It does not record a booster type or in-game activity. Consequently,
`acquisitionKind` distinguishes normal pack-or-trade history, debug grants and
unknown legacy data, but cannot reliably distinguish a pull from a later trade.

### Browse member collections and card provenance

- `GET /v1/groups/{groupId}/member-collections` returns card/copy/foil totals for every approved member.
- `GET /v1/groups/{groupId}/members/{memberId}/collection?offset=0&limit=100` returns that member's card instances.
- `GET /v1/groups/{groupId}/provenance?cardName=Great%20Olm` returns every current group-owned copy and its owner, foil state, original puller and pull time.

### Download missed activity

`GET /v1/groups/{groupId}/sync?after=0&collectionVersion=0&limit=100`

Store `nextCursor` and `collection.version` in the RuneLite profile. Continue
while `hasMore` is true. The complete unlock list is returned only when the
client collection version differs from the server version.
