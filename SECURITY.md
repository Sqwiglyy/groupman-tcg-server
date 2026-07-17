# Security and private reports

Do not publish Group TCG setup keys, group IDs, invite codes, bearer tokens,
Worker URLs, D1 database IDs, database exports, or logs containing request data
in an issue.

Report a suspected credential exposure, privacy problem, or authentication
bypass privately through this repository's **Security** tab by opening a
private vulnerability report. Replace personal and deployment-specific values
with examples wherever possible.

If an invite is exposed, rotate it from the owner client. If a member token is
exposed, revoke that member and let them rejoin. If an owner token or database
export is exposed, take the Worker offline, preserve a private backup, and
replace the deployment before inviting members again.

If an unused Worker's setup key is exposed, replace the encrypted Cloudflare
`SETUP_KEY` secret before creating its group. The key is no longer accepted
after that Worker has been claimed, but should still be removed from any place
where it was disclosed.
