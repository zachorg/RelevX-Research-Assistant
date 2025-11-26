/**
 * Research Scheduler Service
 *
 * Runs cron jobs every minute with two main jobs:
 * 1. Research Job - Executes research for projects that need it
 *    - Pre-runs: Before delivery time based on SCHEDULER_CHECK_WINDOW_MINUTES (status: pending)
 *    - Retries: At or past delivery time if pre-run failed (status: success)
 * 2. Delivery Job - Marks prepared results as delivered when delivery time arrives
 */

import * as dotenv from "dotenv";
import * as cron from "node-cron";
import { logger } from "./logger";

// Load environment variables
dotenv.config();

// Import types from core package
import type { Project } from "core";

// Provider instances (initialized once at startup)
let providersInitialized = false;

/**
 * Get check window in milliseconds (default: 15 minutes)
 */
function getCheckWindowMs(): number {
  const minutes = parseInt(
    process.env.SCHEDULER_CHECK_WINDOW_MINUTES || "15",
    10
  );
  return minutes * 60 * 1000;
}

/**
 * Initialize providers once at startup
 */
async function initializeProviders(): Promise<void> {
  if (providersInitialized) {
    return;
  }

  logger.info("Initializing research providers");

  try {
    // Validate API keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!openaiKey || !braveKey) {
      throw new Error(
        "Missing required API keys (OPENAI_API_KEY or BRAVE_SEARCH_API_KEY)"
      );
    }

    // Import provider classes and setup function from core package
    const { OpenAIProvider, BraveSearchProvider, setDefaultProviders } =
      await import("core");

    // Create provider instances
    const llmProvider = new OpenAIProvider(openaiKey);
    const searchProvider = new BraveSearchProvider(braveKey);

    // Set as defaults for research engine
    setDefaultProviders(llmProvider, searchProvider);

    providersInitialized = true;
    logger.info("Research providers initialized successfully", {
      llmProvider: "OpenAI",
      searchProvider: "Brave Search",
    });
  } catch (error: any) {
    logger.error("Failed to initialize providers", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Execute research for a single project and return delivery log ID
 */
async function executeProjectResearch(
  userId: string,
  project: Project,
  status: "pending" | "success" = "pending"
): Promise<string | null> {
  logger.info("Starting research execution", {
    userId,
    projectId: project.id,
    title: project.title,
    frequency: project.frequency,
    deliveryStatus: status,
  });

  try {
    // Ensure providers are initialized
    await initializeProviders();

    // Import the research engine from core package
    const { executeResearchForProject, db } = await import("core");

    // Update project status to running
    const projectRef = db
      .collection("users")
      .doc(userId)
      .collection("projects")
      .doc(project.id);

    await projectRef.update({
      status: "running",
      researchStartedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Import result-storage to override status
    const { saveDeliveryLog } = await import(
      "core/src/services/research-engine/result-storage"
    );

    // Execute research (this will save with default "success" status)
    // We need to pass the status through the options
    const result = await executeResearchForProject(userId, project.id);

    if (result.success && result.deliveryLogId) {
      // If we need pending status, update the delivery log
      if (status === "pending") {
        const deliveryLogRef = db
          .collection("users")
          .doc(userId)
          .collection("projects")
          .doc(project.id)
          .collection("deliveryLogs")
          .doc(result.deliveryLogId);

        await deliveryLogRef.update({
          status: "pending",
          preparedAt: Date.now(),
          deliveredAt: null,
        });
      }

      logger.info("Research execution completed successfully", {
        userId,
        projectId: project.id,
        resultsCount: result.relevantResults.length,
        durationMs: result.durationMs,
        deliveryLogId: result.deliveryLogId,
        status,
      });

      return result.deliveryLogId;
    } else {
      logger.error("Research execution failed", {
        userId,
        projectId: project.id,
        error: result.error,
      });
      return null;
    }
  } catch (error: any) {
    logger.error("Research execution error", {
      userId,
      projectId: project.id,
      error: error.message,
      stack: error.stack,
    });

    // Update project with error status
    try {
      const { db } = await import("core");
      await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        .doc(project.id)
        .update({
          status: "error",
          lastError: error.message,
          researchStartedAt: null,
          updatedAt: Date.now(),
        });
    } catch (updateError: any) {
      logger.error("Failed to update project error status", {
        userId,
        projectId: project.id,
        error: updateError.message,
      });
    }

    return null;
  }
}

/**
 * Create admin notification for research failure
 */
async function createAdminNotification(
  userId: string,
  project: Project,
  error: string,
  retryCount: number
): Promise<void> {
  try {
    const { db } = await import("core");

    await db.collection("adminNotifications").add({
      type: "research_failure",
      severity: "high",
      projectId: project.id,
      userId,
      projectTitle: project.title,
      errorMessage: error,
      retryCount,
      occurredAt: Date.now(),
      status: "pending",
    });

    logger.info("Admin notification created", {
      projectId: project.id,
      userId,
      retryCount,
    });
  } catch (err: any) {
    logger.error("Failed to create admin notification", {
      error: err.message,
      projectId: project.id,
    });
  }
}

/**
 * Research Job
 * Handles both pre-runs (ahead of delivery time) AND retries (already due)
 * Any project without prepared results gets researched
 */
async function runResearchJob(): Promise<void> {
  try {
    const { db } = await import("core");
    const now = Date.now();
    const checkWindowMs = getCheckWindowMs();
    const prerunMaxTime = now + checkWindowMs;

    logger.debug("Running research job", {
      checkingFrom: new Date(now).toISOString(),
      checkingUntil: new Date(prerunMaxTime).toISOString(),
      windowMinutes: checkWindowMs / 60000,
    });

    // Query all users
    const usersSnapshot = await db.collection("users").get();
    let projectsToRun: Array<{
      userId: string;
      project: Project;
      isRetry: boolean;
    }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Query 1: Pre-run projects (upcoming within check window)
      const prerunSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        .where("status", "==", "active")
        .where("nextRunAt", ">", now)
        .where("nextRunAt", "<=", prerunMaxTime)
        .get();

      for (const projectDoc of prerunSnapshot.docs) {
        const project = {
          id: projectDoc.id,
          ...projectDoc.data(),
        } as Project;

        // Only include if no prepared delivery log
        if (!project.preparedDeliveryLogId) {
          projectsToRun.push({ userId, project, isRetry: false });
        }
      }

      // Query 2: Retry projects (already due but no prepared results)
      const retrySnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        .where("status", "==", "active")
        .where("nextRunAt", "<=", now)
        .get();

      for (const projectDoc of retrySnapshot.docs) {
        const project = {
          id: projectDoc.id,
          ...projectDoc.data(),
        } as Project;

        // Only include if no prepared delivery log (missed pre-run)
        if (!project.preparedDeliveryLogId) {
          // Check if already in list from pre-run query to avoid duplicates
          const alreadyQueued = projectsToRun.some(
            (p) => p.project.id === project.id && p.userId === userId
          );
          if (!alreadyQueued) {
            projectsToRun.push({ userId, project, isRetry: true });
          }
        }
      }
    }

    if (projectsToRun.length === 0) {
      logger.debug("No projects need research");
      return;
    }

    const prerunCount = projectsToRun.filter((p) => !p.isRetry).length;
    const retryCount = projectsToRun.filter((p) => p.isRetry).length;

    logger.info(`Research needed for ${projectsToRun.length} projects`, {
      prerun: prerunCount,
      retry: retryCount,
    });

    // Import scheduling utility for retry projects
    const { calculateNextRunAt } = await import("core/src/utils/scheduling");

    // Execute research for each project
    for (const { userId, project, isRetry } of projectsToRun) {
      try {
        // Track retry attempts
        const retryAttempt = isRetry ? (project.lastError ? 2 : 1) : 0;

        const deliveryLogId = await executeProjectResearch(
          userId,
          project,
          isRetry ? "success" : "pending"
        );

        if (deliveryLogId) {
          // Success - prepare project for delivery
          const updates: any = {
            status: "active",
            researchStartedAt: null,
            lastError: null,
            updatedAt: Date.now(),
          };

          if (isRetry) {
            // For retry, update lastRunAt and nextRunAt immediately
            updates.lastRunAt = Date.now();
            updates.nextRunAt = calculateNextRunAt(
              project.frequency,
              project.deliveryTime,
              project.timezone,
              Date.now()
            );

            logger.info("Retry research succeeded", {
              userId,
              projectId: project.id,
              deliveryLogId,
              retryAttempt,
              nextRunAt: new Date(updates.nextRunAt).toISOString(),
            });
          } else {
            // For pre-run, just save the prepared delivery log
            updates.preparedDeliveryLogId = deliveryLogId;

            logger.info("Pre-run research completed", {
              userId,
              projectId: project.id,
              deliveryLogId,
            });
          }

          await db
            .collection("users")
            .doc(userId)
            .collection("projects")
            .doc(project.id)
            .update(updates);
        } else {
          // Research failed
          if (isRetry && project.lastError) {
            // Second failure - create admin notification
            logger.error("Research failed after retry - notifying admin", {
              userId,
              projectId: project.id,
              retryAttempt: 2,
            });

            await createAdminNotification(
              userId,
              project,
              project.lastError,
              2
            );

            // Move to next scheduled time to avoid infinite retries
            const nextRunAt = calculateNextRunAt(
              project.frequency,
              project.deliveryTime,
              project.timezone,
              Date.now()
            );

            await db
              .collection("users")
              .doc(userId)
              .collection("projects")
              .doc(project.id)
              .update({
                status: "error",
                researchStartedAt: null,
                lastRunAt: Date.now(),
                nextRunAt,
                updatedAt: Date.now(),
              });
          } else {
            // First failure - just clear running status, will retry later
            logger.warn("Research failed, will retry at delivery time", {
              userId,
              projectId: project.id,
              isRetry,
            });

            await db
              .collection("users")
              .doc(userId)
              .collection("projects")
              .doc(project.id)
              .update({
                status: "active",
                researchStartedAt: null,
                updatedAt: Date.now(),
              });
          }
        }
      } catch (error: any) {
        logger.error("Research execution error", {
          userId,
          projectId: project.id,
          isRetry,
          error: error.message,
        });
      }
    }
  } catch (error: any) {
    logger.error("Research job failed", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Delivery Job
 * Check for projects ready to deliver (have preparedDeliveryLogId)
 */
async function runDeliveryJob(): Promise<void> {
  try {
    const { db } = await import("core");
    const now = Date.now();

    logger.debug("Running delivery job");

    // Query all users
    const usersSnapshot = await db.collection("users").get();
    let projectsToDeliver: Array<{ userId: string; project: Project }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Query active projects where nextRunAt <= now AND preparedDeliveryLogId is not null
      const projectsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        .where("status", "==", "active")
        .where("nextRunAt", "<=", now)
        .get();

      for (const projectDoc of projectsSnapshot.docs) {
        const project = {
          id: projectDoc.id,
          ...projectDoc.data(),
        } as Project;

        // Only include if has prepared delivery log
        if (project.preparedDeliveryLogId) {
          projectsToDeliver.push({ userId, project });
        }
      }
    }

    if (projectsToDeliver.length === 0) {
      logger.debug("No projects ready for delivery");
      return;
    }

    logger.info(`Delivering results for ${projectsToDeliver.length} projects`);

    // Import scheduling utility
    const { calculateNextRunAt } = await import("core/src/utils/scheduling");

    // Update delivery logs and projects
    for (const { userId, project } of projectsToDeliver) {
      try {
        // Update delivery log status from pending to success
        await db
          .collection("users")
          .doc(userId)
          .collection("projects")
          .doc(project.id)
          .collection("deliveryLogs")
          .doc(project.preparedDeliveryLogId!)
          .update({
            status: "success",
            deliveredAt: Date.now(),
          });

        // Calculate next run time
        const nextRunAt = calculateNextRunAt(
          project.frequency,
          project.deliveryTime,
          project.timezone,
          now
        );

        // Update project
        await db
          .collection("users")
          .doc(userId)
          .collection("projects")
          .doc(project.id)
          .update({
            lastRunAt: now,
            nextRunAt,
            preparedDeliveryLogId: null,
            updatedAt: Date.now(),
          });

        logger.info("Results delivered successfully", {
          userId,
          projectId: project.id,
          deliveryLogId: project.preparedDeliveryLogId,
          nextRunAt: new Date(nextRunAt).toISOString(),
        });
      } catch (error: any) {
        logger.error("Delivery failed", {
          userId,
          projectId: project.id,
          error: error.message,
        });
      }
    }
  } catch (error: any) {
    logger.error("Delivery job failed", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Main scheduler job - runs every minute
 */
async function runSchedulerJob(): Promise<void> {
  logger.info("Scheduler job started");
  const startTime = Date.now();

  try {
    // Run both jobs in parallel
    // Research job handles both pre-runs and retries
    // Delivery job handles marking prepared results as sent
    await Promise.all([runResearchJob(), runDeliveryJob()]);

    const duration = Date.now() - startTime;
    logger.info("Scheduler job completed", {
      durationMs: duration,
    });
  } catch (error: any) {
    logger.error("Scheduler job failed", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Start the scheduler service
 */
async function startScheduler(): Promise<void> {
  logger.info("Starting Research Scheduler Service");

  // Validate required environment variables
  const requiredEnvVars = [
    "OPENAI_API_KEY",
    "BRAVE_SEARCH_API_KEY",
    "FIREBASE_PROJECT_ID",
  ];

  // Add Admin SDK credential requirement
  if (
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    !process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ) {
    logger.error(
      "Missing Firebase Admin credentials. Set either FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY"
    );
    process.exit(1);
  }

  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    logger.error("Missing required environment variables", {
      missing: missingVars,
    });
    process.exit(1);
  }

  // Firebase Admin is automatically initialized by core package when imported
  logger.info("Firebase Admin SDK will be used (initialized by core package)");

  // Initialize providers at startup
  try {
    await initializeProviders();
  } catch (error: any) {
    logger.error("Failed to initialize providers, cannot start scheduler", {
      error: error.message,
    });
    process.exit(1);
  }

  // Check if scheduler is enabled
  if (process.env.SCHEDULER_ENABLED === "false") {
    logger.warn("Scheduler is disabled by configuration");
    return;
  }

  // Run once at startup (optional, can be disabled)
  if (process.env.RUN_ON_STARTUP !== "false") {
    logger.info("Running initial scheduler job");
    await runSchedulerJob();
  }

  // Set up cron job to run every minute
  // Cron format: * * * * * = every minute
  const cronExpression = "* * * * *";

  logger.info("Setting up cron job", { schedule: cronExpression });

  cron.schedule(cronExpression, async () => {
    await runSchedulerJob();
  });

  logger.info("Scheduler service started successfully", {
    schedule: "Every minute",
    checkWindowMinutes: parseInt(
      process.env.SCHEDULER_CHECK_WINDOW_MINUTES || "15",
      10
    ),
    timezone: process.env.SCHEDULER_TIMEZONE || "UTC",
    providers: {
      llm: "OpenAI",
      search: "Brave Search",
    },
  });

  // Keep the process running
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });
}

// Start the scheduler
startScheduler().catch((error) => {
  logger.error("Failed to start scheduler", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
