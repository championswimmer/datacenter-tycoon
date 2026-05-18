# First backend launch checklist

This checklist is intentionally manual. It describes what must be verified **before** exposing the first public leaderboard backend.

## Pre-launch configuration checks

- [ ] `GET /healthz` returns `200` from the deployed Railway URL.
- [ ] `GET /version` reports the expected server version and `game-logic` version.
- [ ] `CORS_ALLOWED_ORIGINS` includes only the intended frontend origins.
- [ ] Railway Postgres is attached and `DATABASE_URL` is populated for the backend service.
- [ ] The pre-deploy migration command ran successfully against the target database.
- [ ] Database backups / snapshots are enabled in Railway before the backend is announced publicly.
- [ ] Registration and leaderboard rate-limit values are explicitly reviewed for production traffic.
- [ ] Logs are visible in Railway and startup / request-failure output is easy to inspect during launch.
- [ ] The backend still only accepts small JSON summary payloads (`POST /players`, `POST /leaderboard/runs`) rather than full save snapshots or replay blobs.
- [ ] The Railway healthcheck path is set to `/healthz` and passes after deploy.

## Manual smoke test

Run these checks against the deployed base URL after migrations finish.

```bash
export API_BASE_URL="https://api.dctycoon.arnav.tech"

curl -fsS "$API_BASE_URL/healthz"
curl -fsS "$API_BASE_URL/version"
curl -fsS "$API_BASE_URL/players/availability?username=LaunchTester"

PLAYER_RESPONSE=$(curl -fsS -X POST "$API_BASE_URL/players" \
  -H 'content-type: application/json' \
  -d '{"username":"LaunchTester"}')
echo "$PLAYER_RESPONSE"

PLAYER_ID=$(printf '%s' "$PLAYER_RESPONSE" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).playerId));')

curl -fsS -X POST "$API_BASE_URL/leaderboard/runs" \
  -H 'content-type: application/json' \
  -d "{\"playerId\":\"$PLAYER_ID\",\"clientRunId\":\"launch-smoke-001\",\"metrics\":{\"money\":1000000,\"cumulativeRevenue\":1500000,\"totalServers\":4,\"computeCapacity\":64,\"memoryCapacity\":512,\"storageCapacity\":128,\"gpuCapacity\":0},\"gameMonth\":3}"

curl -fsS "$API_BASE_URL/leaderboard?metric=money&period=all-time&limit=5"
```

## Rollback / disable-online plan

If the backend needs to be rolled back without breaking local play:

1. Remove or unset `VITE_API_BASE_URL` in the web frontend environment and redeploy the web app.
2. Confirm the start flow falls back to local-only play and shows the offline leaderboard notice.
3. If necessary, remove the custom domain or tighten `CORS_ALLOWED_ORIGINS` so browsers stop submitting online requests.
4. Keep the database intact unless a migration rollback is explicitly required; Postgres remains the source of truth.
5. If a bad migration must be reverted, restore from the latest Railway backup/snapshot before re-enabling traffic.

## Notes

- This launch does **not** promise replay-verified anti-cheat protection.
- The safest emergency fallback is to disable `VITE_API_BASE_URL` in the frontend while keeping the game itself playable offline.
