# Indexing Worker Deployment

This process is a **continuous background worker**, not a request/response web app.

Use this command as the process entrypoint:

```bash
pnpm --filter @workspace/agent worker:index
```

Or use Docker:

```bash
docker build -f apps/agent/Dockerfile.worker -t ADE-index-worker .
docker run --env-file apps/agent/.env ADE-index-worker
```

## Required env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `E2B_API_KEY`
- `OPENAI_API_KEY` (if your pipeline/nodes use OpenAI)
- Any other vars used by `apps/agent/src/indexing/pipeline.ts` and shared packages

## Platform notes

- Vercel is not suitable for a continuously running process like this.
- Deploy this as a **Worker / Background Service** on a container host.
- Keep your `apps/web` app on Vercel and run this worker separately.
