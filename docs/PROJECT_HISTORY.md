# The shared foundation behind my Garage and Trip Ledger apps

My Garage and Trip Ledger applications started with workflows I was already using: keeping maintenance or travel records in spreadsheets and asking ChatGPT to help organize them. I wanted a dashboard for those records and a way to keep using a conversation as another interface.

The reusable part was the boundary between the interfaces and the data. Whether a request comes from the browser or an MCP client, it needs a verified identity, validated input and the same ownership checks. A prompt should not be able to select someone else's records. Retrying a create request should not quietly create a second copy.

The public starter demonstrates that boundary with notes. It uses Cloudflare Workers and D1, verifies signed Access assertions and routes the browser and MCP tools through the same owner-scoped API. Managed OAuth is configured at Cloudflare's edge. The starter itself does not run an LLM, connect to a bank or need an OpenAI API key.

Version 0.1.0 was published on November 6, 2026. Six Node tests passed, including signed-token rejection, owner isolation, duplicate-safe creation and real SDK tool calls. Wrangler bundled the Worker in a dry run. Local browser checks at phone and desktop widths exercised creation, editing, deletion and safe text rendering.

The underlying approach runs in my private apps. The extracted starter has not yet been deployed against a fresh user's Access account, so its deployment guide asks for a real two-user check before storing private notes. It is deliberately a small example: there is no sharing, admin override, pagination or edit history yet.

## Keeping this history useful

This is a retrospective of the work that actually led to the first release, not a reconstructed commit sequence. Further changes should be committed as they happen, with plain-language messages explaining the problem, the decision and the checks that were run. Source and documentation were prepared with AI assistance; the verification limits above remain part of the project history.
