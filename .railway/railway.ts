import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const datacenterTycoon = github("championswimmer/datacenter-tycoon", { branch: "main", checkSuites: false });

  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 5000 });
  // v1 — TypeScript server (Bun + Elysia). Replaces the root railway.toml.
  const dctycoonApi = service("dctycoon-api", {
    source: datacenterTycoon,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: [
        "packages/server/**",
        "packages/game-logic/**",
        "Dockerfile",
        "package.json",
        "package-lock.json",
        "tsconfig*.json",
      ],
    },
    deploy: {
      preDeployCommand: ["bun run packages/server/dist/db/migrate.js"],
      startCommand: "bun run packages/server/dist/index.js",
      healthcheckPath: "/healthz",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    replicas: { "us-west2": 1 },
    env: { CORS_ALLOWED_ORIGINS: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve() },
  });
  const dctycoon3d = service("dctycoon-3d", {
    source: datacenterTycoon,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "packages/web-3d/Dockerfile",
      watchPatterns: [
        "packages/web-3d/**",
        "packages/web/**",
        "packages/game-logic/**",
        "assets/**",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
      ],
    },
    deploy: {
      startCommand: "node packages/web-3d/scripts/serve-prod.mjs",
      healthcheckPath: "/healthz",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    replicas: { "us-west2": 1 },
    env: {
      NODE_ENV: "production",
      RAILWAY_DOCKERFILE_PATH: "packages/web-3d/Dockerfile",
      VITE_API_BASE_URL: "https://dctycoon-api-production.up.railway.app",
    },
  });
  // v2 — Go server (packages/server-go). Shares the Postgres service (and schema_migrations table) with v1.
  const dctycoonApiV2 = service("dctycoon-api-v2", {
    source: datacenterTycoon,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "packages/server-go/Dockerfile",
      // game-logic is embedded as the committed bundle (packages/server-go/jsbridge/bundle.js).
      watchPatterns: ["packages/server-go/**"],
    },
    deploy: {
      preDeployCommand: ["/app/migrate"],
      startCommand: "/app/server",
      healthcheckPath: "/healthz",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    replicas: { "europe-west4-drams3a": 1 },
    env: { CORS_ALLOWED_ORIGINS: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve() },
  });

  return project("datacenter-tycoon", {
    variables: { managed: true },
    resources: [dctycoonApi, Postgres, dctycoon3d, dctycoonApiV2, postgresVolume],
  });
});
