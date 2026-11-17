import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const datacenterTycoon = github("championswimmer/datacenter-tycoon", { branch: "main", checkSuites: false });

  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 5000 });
  // Default API — Go server (packages/server-go). The legacy TS server (packages/server, former `dctycoon-api`) is no longer deployed.
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
    resources: [Postgres, dctycoonApiV2, postgresVolume],
  });
});
