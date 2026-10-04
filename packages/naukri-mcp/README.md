# Naukri apply MCP

Local [Model Context Protocol](https://modelcontextprotocol.io) server for preparing Naukri job applications from Cursor, Claude, or any other MCP client.

Naukri does not publish a job-seeker API for search or apply. This server does **not** log into Naukri, scrape listings, or click Apply. It keeps your profile and drafts on disk, builds a public search link, and tracks each job until **you** submit it on naukri.com.

## How a job gets in

Nothing is downloaded from Naukri. `build_search_links` only formats a normal browser URL, for example:

`https://www.naukri.com/data-scientist-jobs-in-pune?k=data+scientist&l=Pune&experience=2`

You open that page, pick a posting, and paste the job URL plus the description into chat. `save_job` stores that paste locally. Later tools score it, draft answers, and remind you to click Apply yourself.

## Tools

| Tool | What it does |
| --- | --- |
| `update_profile` / `get_profile` | Save skills, summary, locations, notice period, and CTC text locally |
| `build_search_links` | Return a public `https://www.naukri.com/...` search URL |
| `save_job` | Store a job URL and description you pasted from Naukri |
| `score_job` | Compare that job with your profile |
| `save_draft` | Store the why-me note and question answers written in chat |
| `prepare_apply_packet` | Hand back the job URL, profile, and draft for you to paste |
| `confirm_submitted` | Mark the job applied after you say you clicked Apply |
| `list_jobs` / `get_job` / `update_job_status` | Review the local tracker |

Data lives in `~/.naukri-mcp/data.json` (override with `NAUKRI_MCP_HOME`). Do not put a Naukri password in the profile.

## Run

```bash
pnpm install
pnpm --filter @agentic/naukri-mcp build
pnpm --filter @agentic/naukri-mcp test
node packages/naukri-mcp/dist/index.js
```

HTTP, bound to localhost, for clients that speak Streamable HTTP:

```bash
node packages/naukri-mcp/dist/index.js --http 8787
```

## Cursor

Add this to `~/.cursor/mcp.json` (adjust the path):

```json
{
  "mcpServers": {
    "naukri": {
      "command": "node",
      "args": ["/absolute/path/to/packages/naukri-mcp/dist/index.js"]
    }
  }
}
```

## Claude Desktop

```json
{
  "mcpServers": {
    "naukri": {
      "command": "node",
      "args": ["/absolute/path/to/packages/naukri-mcp/dist/index.js"]
    }
  }
}
```

## ChatGPT

ChatGPT connectors expect a **remote** MCP URL over HTTPS. This process only listens on `127.0.0.1`. Run `--http`, then expose that port with a tunnel you control, and add the public `/mcp` URL as a custom connector. The tunnel is your account; this package does not host one.

## Chat workflow

1. “Save my profile: 5 years, TypeScript, Bengaluru, 30-day notice.”
2. “Find backend jobs in Bengaluru.” The assistant returns a Naukri search link. You open it.
3. Paste a job URL and description. The assistant scores it and drafts answers.
4. You open the job and click Apply, using the draft where the form asks.
5. “I submitted it.” The assistant calls `confirm_submitted`.
