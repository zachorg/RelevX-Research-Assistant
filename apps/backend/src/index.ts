import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import auth from "./plugins/auth.js";
import rl from "./plugins/rate-limit.js";
import errors from "./plugins/errors.js";
import firebase from "./plugins/firebase.js";
import stripe from "./plugins/stripe.js";
import userBillingRoutes from "./routes/userBilling.js";
import productsRoutes from "./routes/products.js";
import userAuthRoutes from "./routes/userAuth.js";
import userProjectsRoutes from "./routes/userProjects.js";
import rawBody from "fastify-raw-body";
import fastifyCompress from "@fastify/compress";
import aws from "./plugins/aws.js";
import stripeRoute from "./routes/stripeRoute.js";
import fastifyRedis from "@fastify/redis";

// Fastify app with structured logging enabled. We redact sensitive fields by
// default to avoid leaking destinations/PII in application logs.
const app = Fastify({
  logger: {
    level: "info",
    redact: {
      paths: ["destination", "body.destination", "req.body.destination"],
      censor: "[REDACTED]",
    },
    serializers: {
      req(request) {
        const MAX_URL_LENGTH = 50; // Set your desired limit
        const url = request.url;

        return {
          method: request.method,
          // Truncate the URL if it's too long
          url:
            url.length > MAX_URL_LENGTH
              ? url.substring(0, MAX_URL_LENGTH) + "..."
              : url,
          hostname: request.hostname,
          remoteAddress: request.ip,
        };
      },
    },
  },
  bodyLimit: 1048576,
});

await app.register(fastifyCors, {
  origin: [
    "https://relevx.ai",
    "https://www.relevx.ai",
    "https://api.relevx.ai",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "planId",
    "projectId",
    "token",
  ],
  methods: ["GET", "POST", "DELETE", "OPTIONS", "PUT", "PATCH"],
});

// Core platform plugins. Registration order matters for dependencies:
// - errors early to ensure consistent error shaping
// - rawBody must be registered early to intercept body parsing
await app.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: false,
  runFirst: true,
});
await app.register(errors);

// Redis
app.register(fastifyRedis, { url: process.env.REDIS_URL || "" });
app.get("/ping-redis", async (_request, _reply) => {
  const { redis } = app;
  await redis.set("last_ping", Date.now());
  const val = await redis.get("last_ping");

  return { redis_status: "Connected", last_ping: val };
});

await app.register(aws);
await app.register(fastifyCompress);

try {
  // defaulting to relevx-secrets, but this should be set in the environment
  const secretName = "relevx-backend-env";
  // The aws plugin decorates the app with the aws object
  const secrets = await app.aws.getSecret(secretName);

  if (secrets) {
    const parsedSecrets = JSON.parse(secrets);
    for (const [key, value] of Object.entries(parsedSecrets)) {
      process.env[key] = value as string;
    }
    app.log.info(`Loaded secrets from AWS Secrets Manager: ${secretName}`);
  }
} catch (error) {
  app.log.warn(error, "Failed to load secrets from AWS Secrets Manager");
}

const PORT = Number(process.env.PORT || 3000);

// Startup log to aid operational visibility
app.log.info(
  {
    env: process.env.NODE_ENV || "development",
    port: PORT,
    cors: process.env.CORS_ORIGIN || false,
  },
  "Starting RelevX API server"
);

app.get("/", { config: { rateLimit: false } }, async (_req, rep) => {
  return rep.status(200).send({ ok: true });
});

app.get("/healthz", { config: { rateLimit: false } }, async (_req, rep) => {
  return rep.status(200).send({ ok: true });
});

const start = async () => {
  try {
    // Explicitly define 0.0.0.0 to accept external traffic
    app.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    await app.register(firebase);
    await app.register(fastifyWebsocket);
    await app.register(fastifyRateLimit, { global: false });
    await app.register(rl);
    await app.register(auth);
    await app.register(stripe);
    // Business routes
    await app.register(userBillingRoutes, { prefix: "/api/v1/user/billing" });
    await app.register(stripeRoute, { prefix: "api/v1/stripe" });
    await app.register(productsRoutes, { prefix: "/api/v1/products" });
    await app.register(userAuthRoutes, { prefix: "/api/v1/user/auth" });
    await app.register(userProjectsRoutes, { prefix: "/api/v1/user/projects" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
