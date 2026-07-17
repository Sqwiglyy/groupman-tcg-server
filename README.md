# Groupman TCG Server

Cloudflare Worker and D1 database used by the Groupman TCG RuneLite plugin for
durable group unlocks and offline pack history. RuneLite Party can still carry
instant reveals; this API makes every approved member converge after reconnecting.

Production API: `https://groupman-tcg-api.sqwiglyy.workers.dev`

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

## Deploying to Cloudflare

1. Authenticate: `pnpm wrangler login`
2. Create D1: `pnpm wrangler d1 create groupman-tcg`
3. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.
4. Apply the production migration: `pnpm db:migrate:remote`
5. Deploy: `pnpm deploy`
6. Verify the returned URL at `/health`.

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
