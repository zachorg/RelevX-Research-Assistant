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
import dotenv from "dotenv";

// Load .env file from the secrets directory or root
// This will load environment variables before AWS Secrets Manager
dotenv.config({ path: "apps/backend/.env" });
dotenv.config(); // Also try loading from default .env location

// Fastify app with structured logging enabled. We redact sensitive fields by
// default to avoid leaking destinations/PII in application logs.
const app = Fastify({
  logger: {
    level: "info",
    redact: {
      paths: ["destination", "body.destination", "req.body.destination"],
      censor: "[REDACTED]",
    },
  },
  bodyLimit: 1048576,
});

// app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
//   try {
//     // Attach the raw body to the request object for later use
//     req.rawBody = body;

//     // Parse the body as usual for req.body
//     const json = JSON.parse(body as string);
//     done(null, json);
//   } catch (err: any) {
//     err.statusCode = 400; // Handle parsing errors
//     done(err, undefined);
//   }
// })

await app.register(fastifyCors, {
  origin: (origin, cb) => {
    const allowedOrigins = ["https://relevx.ai", "http://localhost:3001"];
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed"), false);
    }
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "planId",
    "token",
  ],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
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
await app.register(aws);
await app.register(fastifyCompress);

// try {
//   // defaulting to relevx-secrets, but this should be set in the environment
//   const secretName = "relevx-backend-env";
//   // The aws plugin decorates the app with the aws object
//   const secrets = await app.aws.getSecret(secretName);

//   if (secrets) {
//     const parsedSecrets = JSON.parse(secrets);
//     for (const [key, value] of Object.entries(parsedSecrets)) {
//       process.env[key] = value as string;
//     }
//     app.log.info(`Loaded secrets from AWS Secrets Manager: ${secretName}`);
//   }
// } catch (error) {
//   app.log.warn(error, "Failed to load secrets from AWS Secrets Manager");
// }

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
