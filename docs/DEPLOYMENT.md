# Deployment and OAuth

## Configure Cloudflare

1. Run `npx wrangler login` and create your database with `npx wrangler d1 create private-mcp-starter`.
2. Put that database UUID in production `wrangler.jsonc`. Keep the local config's placeholder separate. Apply `npx wrangler d1 migrations apply private-mcp-starter --remote` after reviewing the migration.
3. Create a Cloudflare Access self-hosted application for the custom hostname you will attach to this Worker. Configure an identity provider and an explicit approved-user policy.
4. Set ACCESS_ISSUER to your team HTTPS domain, ACCESS_AUDIENCE to this Access application's AUD (not another app's audience), and ALLOWED_EMAILS to the normalized emails you approve. These identifiers are not substitutes for the Access policy; both layers apply.
5. Run `npm run deploy`, then attach your custom domain through Workers → Settings → Domains & Routes. workers.dev and preview URLs are disabled in this template. Keep `assets.run_worker_first` enabled so assets require authentication too.
6. Test a signed-out browser, script URL, `/api/state` and `/mcp`; none should expose private data. Log in using two separate approved identities and verify record isolation. Do this before storing real notes.

Placeholder configuration fails closed in the Worker. Never deploy `wrangler.local.jsonc`, enable a production local bypass, or add an Access bypass policy to get a demo working.

## Connect ChatGPT or another remote MCP client

Enable Cloudflare **Managed OAuth** for the same Access application. Keep the approved-user policy and identity provider. In ChatGPT's custom MCP/plugin setup, use `https://YOUR_HOSTNAME/mcp` and OAuth authentication. Keep the discovered OAuth endpoints.

Copy the exact callback URI shown by the client into the Access application's allowed redirect URIs. Client callback formats can change and can be connection-specific; do not guess a callback or reuse a callback ID from another installation. Keep localhost/loopback callback allowances disabled unless you actually need a local OAuth client. Each user signs in and grants access separately.

The edge exchanges/resolves OAuth credentials and forwards the signed Access assertion, which the Worker independently validates. Sending an arbitrary Authorization token or email header directly to this Worker does not grant access.

Test: “Read my notes and confirm my signed-in identity. Keep this read-only.” Then create a disposable note, retry the same request ID, and verify only one note was saved. Confirm another identity cannot read/update it. Remove the disposable note through the dashboard.

## References

- [Cloudflare Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)
- [OpenAI custom MCP setup](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [OpenAI OAuth requirements and callback modes](https://developers.openai.com/plugins/build/auth)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/latest/basic/authorization)

Provider/account plans and client availability have their own limits; this template does not provision or promise a particular service plan.
