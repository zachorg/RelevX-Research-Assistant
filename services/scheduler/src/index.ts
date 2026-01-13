/**
 * Research Scheduler Service
 *
 * Runs cron jobs every minute with two main jobs:
 * 1. Research Job - Executes research for projects that need it
 *    - Pre-runs: Before delivery time based on SCHEDULER_CHECK_WINDOW_MINUTES (status: pending)
 *    - Retries: At or past delivery time if pre-run failed (status: success)
 * 2. Delivery Job - Marks prepared results as delivered when delivery time arrives
 */

import * as cron from "node-cron";
import { logger } from "./logger";
import { Filter } from "firebase-admin/firestore";
import { loadAwsSecrets } from "./plugins/aws";
import { Queue } from "elegant-queue";

// Import types from core package
import type { NewDeliveryLog, Plan, Project, RelevxUserProfile } from "core";
import { sendReportEmail } from "core";

// Import scheduling utility
import { calculateNextRunAt } from "core";
import { check_and_increment_research_usage } from "./plugins/analytics";

const getErrorMessage = (
  errorCode: string,
  userId: string,
  projectId: string,
  errorMessage: string
): string => {
  return `${errorCode}:${userId}:${projectId}:${errorMessage}`;
};

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

async function getRemoteConfigParam(key: string) {
  try {
    const { fireBaseRemoteConfig } = await import("core");
    const param = (await fireBaseRemoteConfig.getTemplate()).parameters[key];
    return param;
  } catch (error) {
    console.error("Error fetching remote config:", error);
  }
  return null;
}

async function getPlans(): Promise<Plan[]> {
  const config = await getRemoteConfigParam("plans");
  const plansRaw = config?.defaultValue?.value;
  if (plansRaw) {
    const parsed = JSON.parse(plansRaw);
    const plansArray: Plan[] = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed);

    if (!Array.isArray(plansArray)) {
      throw new Error("Parsed plans is not an array or valid object");
    }
    return plansArray;
  }

  return [];
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
  // Ensure providers are initialized
  await initializeProviders();

  // import db
  const { db } = await import("core");
  const now = Date.now();
  const checkWindowMs = getCheckWindowMs();
  const prerunMaxTime = now + checkWindowMs;

  interface PolledProject {
    userId: string;
    project: Project;
    projectRef: any;
    isRetry: boolean;
  }

  // polls projects that need research
  const pollResearchProjects = async (): Promise<Array<PolledProject>> => {
    // Query all users
    const usersSnapshot = await db.collection("users").get();

    let projectsToRun: Array<PolledProject> = [];
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Query 1: Pre-run projects (upcoming within check window)
      const prerunSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        // active and projects with error need to be taken care off.
        .where(
          Filter.or(
            Filter.where("status", "==", "active"),
            Filter.where("status", "==", "error")
          )
        )
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
          projectsToRun.push({
            userId,
            project,
            isRetry: false,
            projectRef: projectDoc.ref,
          } as PolledProject);
        }
      }

      // Query 2: Retry projects (already due but no prepared results)
      const retrySnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("projects")
        .where(
          Filter.or(
            Filter.where("status", "==", "active"),
            Filter.where("status", "==", "error")
          )
        )
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
            projectsToRun.push({
              userId,
              project,
              isRetry: true,
              projectRef: projectDoc.ref,
            } as PolledProject);
          }
        }
      }
    }

    return projectsToRun;
  };

  // Marks all polled projects as running
  const markPolledProjectsAsRunning = async (
    polledProjects: Array<PolledProject>
  ) => {
    for (const polledProject of polledProjects) {
      await polledProject.projectRef.update({
        status: "running",
        updatedAt: Date.now(),
      });
    }
  };

  // executes research for a single project
  const executeResearch = async (polledProject: PolledProject) => {
    // Import the research engine from core package
    // Import scheduling utility for retry projects
    const { executeResearchForProject } = await import("core");
    const { userId, project, isRetry, projectRef } = polledProject;

    // 1). Get user and plan
    const userDoc = await db.collection("users").doc(userId);

    const plans = await getPlans();
    const userData = (await userDoc.get())?.data() as RelevxUserProfile;
    const plan = plans.find((p) => p.id === userData.planId);

    if (!plan) {
      throw new Error(
        getErrorMessage("E500", userId, project.id, "Plan not found")
      );
    }

    // 2). Track retry attempts
    const retryAttempt = isRetry ? (project.lastError ? 2 : 1) : 0;

    // 3). Update project status to running
    await projectRef.update({
      status: "running",
      researchStartedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 4). Execute research
    const deliveryLogId = await check_and_increment_research_usage(
      async () => {
        // Execute research (this will save with default "success" status)
        // We need to pass the status through the options
        const result = await executeResearchForProject(userId, project.id);

        if (result.success && result.deliveryLogId) {
          logger.info("Research execution completed successfully", {
            userId,
            projectId: project.id,
            resultsCount: result.relevantResults.length,
            durationMs: result.durationMs,
            deliveryLogId: result.deliveryLogId,
            status: project.status,
          });

          return result.deliveryLogId;
        } else {
          throw new Error(
            getErrorMessage(
              "E0",
              userId,
              project.id,
              result.error || "Research execution failed"
            )
          );
        }
      },
      db,
      userId,
      plan,
      project.title
    );

    let projectUpdates: any = {
      status: "active",
      researchStartedAt: null,
      updatedAt: Date.now(),
    };

    // 5). Update project status based on research result
    if (deliveryLogId) {
      // Success - prepare project for delivery
      projectUpdates = {
        ...projectUpdates,
        lastError: null,
        preparedDeliveryLogId: deliveryLogId,
        status: "active",
        preparedAt: Date.now(),
        deliveredAt: null,
      };

      // For retry, we DO NOT update nextRunAt here.
      // We leave it in the past so the Delivery Job picks it up immediately.
      // The Delivery Job will send the email and THEN update nextRunAt.
      // For pre-run, just save the prepared delivery log
      logger.info(`${isRetry ? "Retry" : "Pre-run"} research succeeded`, {
        userId,
        projectId: project.id,
        deliveryLogId,
        retryAttempt,
      });
    }
    // else if (isRetry && project.lastError) {
    //   // Second failure - create admin notification
    //   logger.error("Research failed after retry - notifying admin", {
    //     userId,
    //     projectId: project.id,
    //     retryAttempt: 2,
    //   });

    //   await createAdminNotification(userId, project, project.lastError, 2);

    //   // Move to next scheduled time to avoid infinite retries
    //   const nextRunAt = calculateNextRunAt(
    //     project.frequency,
    //     project.deliveryTime,
    //     project.timezone,
    //     project.dayOfWeek,
    //     project.dayOfMonth
    //   );

    //   projectUpdates = {
    //     ...projectUpdates,
    //     nextRunAt,
    //     lastRunAt: Date.now(),
    //   };
    // }

    await projectRef.update(projectUpdates);
  };
  try {
    logger.debug("Running research job", {
      checkingFrom: new Date(now).toISOString(),
      checkingUntil: new Date(prerunMaxTime).toISOString(),
      windowMinutes: checkWindowMs / 60000,
    });

    // poll research projects
    let projectsToRun: Array<PolledProject> = await pollResearchProjects();

    if (projectsToRun.length === 0) {
      logger.debug("No projects need research");
      return;
    }

    // avoid race conditions if a project takes longer than a minute to run...
    markPolledProjectsAsRunning(projectsToRun);

    const prerunCount = projectsToRun.filter((p) => !p.isRetry).length;
    const retryCount = projectsToRun.filter((p) => p.isRetry).length;

    logger.info(`Research needed for ${projectsToRun.length} projects`, {
      prerun: prerunCount,
      retry: retryCount,
      projectsToRun,
    });

    // Execute research for each project
    for (const polledProject of projectsToRun) {
      try {
        await executeResearch(polledProject);
      } catch (error: any) {
        logger.error("Research execution error", {
          userId: polledProject.userId,
          projectId: polledProject.project.id,
          isRetry: polledProject.isRetry,
          error: error.message,
        });
        const splits = error.message.split(":")[0];
        const errorCode = splits[0];
        const userId = splits[1];
        const projectId = splits[2];
        const errorMessage = splits[3];

        // E1 is for daily limit exceeded -- that means we do not need to error out the project..
        if (errorCode !== "E1") {
          // Update project with error status
          try {
            const { db } = await import("core");
            await db
              .collection("users")
              .doc(userId)
              .collection("projects")
              .doc(projectId)
              .update({
                status: "error",
                lastError: errorMessage,
                researchStartedAt: null,
                updatedAt: Date.now(),
              });
          } catch (updateError: any) {
            logger.error("Failed to update project error status", {
              userId,
              projectId,
              error: updateError.message,
            });
          }
        }

        logger.error("Research execution error", {
          error: error.message,
          stack: error.stack,
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

const gDeliveryQueue = new Queue<DeliveryItem>();
interface DeliveryItem {
  userId: string;
  userRef: any;
  project: Project;
  projectRef: any;
  deliveryLogDoc: any;
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
    // @TODO: Instead of using users to query projects, use projects collection altogether and then reference the user from the project
    // @TODO: Use pagination to avoid loading all projects at once
    // @TODO: Future update ^ - will become non-scalable
    const usersSnapshot = await db.collection("users").get();
    let projectsToDeliver: Array<{
      userId: string;
      userRef: any;
      project: Project;
      projectRef: any;
    }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      const userRef = await db.collection("users").doc(userId);
      // Query active projects where nextRunAt <= now AND preparedDeliveryLogId is not null
      const projectsSnapshot = await userRef
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
          projectsToDeliver.push({
            userId,
            userRef,
            project,
            projectRef: projectDoc.ref,
          });
        }
      }
    }

    if (projectsToDeliver.length === 0) {
      logger.debug("No projects ready for delivery");
      return;
    }

    logger.info(`Delivering results for ${projectsToDeliver.length} projects`);

    // Update delivery logs and projects
    for (const { userId, userRef, project, projectRef } of projectsToDeliver) {
      sendClientProjectReport(userId, userRef, project, projectRef);
    }
  } catch (error: any) {
    logger.error("Delivery job failed", {
      error: error.message,
      stack: error.stack,
    });
  }
}

async function sendClientProjectReport(
  userId: string,
  userRef: any,
  project: Project,
  projectRef: any
) {
  try {
    const deliveryLogSnapshot = await projectRef
      .collection("deliveryLogs")
      .where("status", "==", "pending")
      .get();
    if (deliveryLogSnapshot.docs.length === 0) {
      logger.warn("Project has no pending delivery log (s)", {
        userId,
        projectId: project.id,
      });
      return;
    }
    if (project.resultsDestination === "email") {
      for (const deliveryLogDoc of deliveryLogSnapshot.docs) {
        gDeliveryQueue.enqueue({
          userId,
          userRef,
          project,
          projectRef,
          deliveryLogDoc,
        });
      }
    }
  } catch (error: any) {
    logger.error("Delivery failed", {
      userId,
      projectId: project.id,
      error: error.message,
    });
  }
}

// for now we can only handle 2 emails a second before we hit rate limits
async function runDeliveryQueue() {
  const now = Date.now();
  for (let i = 0; i < 2 && gDeliveryQueue.isEmpty() === false; i++) {
    const deliveryItem = gDeliveryQueue.dequeue();
    const { userId, userRef, project, projectRef, deliveryLogDoc } =
      deliveryItem;
    try {
      // Load user (for email fallback)
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        logger.error("User not found", {
          userId,
          projectId: project.id,
          deliveryLogId: project.preparedDeliveryLogId,
        });
        return;
      }
      const userData = userDoc.data() as RelevxUserProfile;
      const userEmail = userData.email;

      // Send email if configured
      const deliveryEmail = project.deliveryConfig?.email?.address || userEmail;

      if (project.resultsDestination === "email" && deliveryEmail) {
        logger.info(`Sending report email to ${deliveryEmail}...`);
        const deliveryLog = deliveryLogDoc.data() as NewDeliveryLog;
        const deliveryLogRef = deliveryLogDoc.ref;

        try {
          const emailResult = await sendReportEmail(
            deliveryEmail,
            {
              title: deliveryLog.reportTitle,
              markdown: deliveryLog.reportMarkdown,
            },
            project.id,
            {
              summary: deliveryLog.reportSummary,
              resultCount: deliveryLog.stats?.includedResults,
              averageScore: deliveryLog.stats?.averageRelevancyScore
                ? Math.round(deliveryLog.stats.averageRelevancyScore)
                : undefined,
            }
          );

          if (emailResult.success) {
            console.log("Email sent successfully:", emailResult.id);

            // Update delivery log status from pending to success
            await deliveryLogRef.update({
              status: "success",
              deliveredAt: Date.now(),
            });

            // Calculate next run time
            const nextRunAt = calculateNextRunAt(
              project.frequency,
              project.deliveryTime,
              project.timezone,
              project.dayOfWeek,
              project.dayOfMonth
            );

            // Update project
            await projectRef.update({
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
          } else {
            logger.error("Failed to send email:", emailResult.error);
          }
        } catch (emailError) {
          logger.error("Exception sending email:", emailError);
        }
      }
    } catch (error: any) {
      logger.error("Delivery failed", {
        userId,
        projectId: project.id,
        error: error.message,
      });
    }
  }
}

/**
 * Main scheduler job - runs every minute
 */
async function runSchedulerJob(): Promise<void> {
  logger.debug("Scheduler job started");
  const startTime = Date.now();

  try {
    // Run both jobs in parallel
    // Research job handles both pre-runs and retries
    // Delivery job handles marking prepared results as sent and sending emails
    await Promise.all([runResearchJob(), runDeliveryJob()]);

    const duration = Date.now() - startTime;
    logger.debug("Scheduler job completed", {
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

  // Load secrets from AWS Secrets Manager if available
  await loadAwsSecrets("relevx-backend-env");

  // Validate required environment variables
  const requiredEnvVars = [
    "OPENAI_API_KEY",
    "BRAVE_SEARCH_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
  ];

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

  // this can cause race conditions.
  cron.schedule(cronExpression, async () => {
    await runSchedulerJob();
  });
  // Run delivery queue every 1.2second
  setInterval(async () => {
    await runDeliveryQueue();
  }, 1200);

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
