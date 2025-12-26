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
import aws from "./plugins/aws.js";
import stripeRoute from "./routes/stripeRoute.js";

// set env path location


// Fastify app with structured logging enabled. We redact sensitive fields by
// default to avoid leaking destinations/PII in application logs.
const app = Fastify({
  logger: {
    level: "info",
    redact: {
      paths: ["destination", "body.destination", "req.body.destination"],
      censor: "[REDACTED]"
    }
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
  origin: true, // Accept any origin
  credentials: true, // Allow credentials
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "planId", "token"],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
});

// Core platform plugins. Registration order matters for dependencies:
// - errors early to ensure consistent error shaping
// - rawBody must be registered early to intercept body parsing
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: false,
  runFirst: true
});
await app.register(errors);
await app.register(aws);

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

// Startup log to aid operational visibility
app.log.info({
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT_RELEVX || 8080),
  cors: process.env.CORS_ORIGIN || false
}, "Starting RelevX API server");

app.get("/healthz", async (_req, rep) => {
  return rep.send({ ok: true });
});

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT || 8080) });




