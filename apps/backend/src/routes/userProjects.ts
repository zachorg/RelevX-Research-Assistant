import type { FastifyPluginAsync } from "fastify";
import type {
  ProjectInfo,
  ListProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  Plan,
  RelevxDeliveryLog,
  DeliveryLog,
  ProjectDeliveryLogResponse,
  AnalyticsDocument,
} from "core";
import { Frequency, getUserAnalytics } from "core";
import { set, isAfter, add } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { isUserSubscribed } from "../utils/billing.js";
import { getUserData } from "../utils/user.js";
import { Redis } from "ioredis";
import { getPlans } from "./products.js";

const listeners = new Map<string, () => void>();

// 1. Create a dedicated subscriber connection
// We don't use the main fastify.redis because it's busy with GET/SET
const subscriber = new Redis(process.env.REDIS_URL || "");

subscriber.on("error", (err) => console.log("Redis Client Error", err));

/**
 * Add one frequency period to a date
 * @param date - Starting date
 * @param frequency - Period to add
 * @returns New date with period added
 */
function addFrequencyPeriod(date: Date, frequency: Frequency): Date {
  switch (frequency) {
    case "daily":
      return add(date, { days: 1 });
    case "weekly":
      return add(date, { weeks: 1 });
    case "monthly":
      return add(date, { months: 1 });
  }
}

/**
 * Calculate the new run timestamp based on frequency, delivery time, and timezone. If delivery time has passed, it will calculate the next run based on the frequency.
 * @param frequency - daily, weekly, or monthly
 * @param deliveryTime - HH:MM format in user's timezone
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param dayOfWeek - 0-6 (Sunday-Saturday), used when frequency is "weekly"
 * @param dayOfMonth - 1-31, used when frequency is "monthly"
 * @returns Timestamp (milliseconds) for next execution
 */
function calculateNewRunAt(
  frequency: Frequency,
  deliveryTime: string,
  timezone: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  forceNextRun: boolean = false
): number {
  // Parse delivery time
  const [hours, minutes] = deliveryTime.split(":").map(Number);

  // Get current time in UTC
  const now = new Date();

  // Convert to user's timezone
  const nowInUserTz = toZonedTime(now, timezone);

  // Set the delivery time for today in user's timezone
  let nextRunInUserTz = set(nowInUserTz, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });

  // Handle weekly frequency - find the next occurrence of the specified day
  if (frequency === "weekly" && dayOfWeek !== undefined) {
    const currentDayOfWeek = nextRunInUserTz.getDay();
    let daysUntilTarget = dayOfWeek - currentDayOfWeek;

    // If today is the target day but time has passed, or if target day is earlier in week
    if (
      daysUntilTarget < 0 ||
      (daysUntilTarget === 0 && !isAfter(nextRunInUserTz, nowInUserTz))
    ) {
      daysUntilTarget += 7;
    }

    nextRunInUserTz = add(nextRunInUserTz, { days: daysUntilTarget });
  }
  // Handle monthly frequency - find the next occurrence of the specified day
  else if (frequency === "monthly" && dayOfMonth !== undefined) {
    const currentDay = nextRunInUserTz.getDate();
    const currentMonth = nextRunInUserTz.getMonth();
    const currentYear = nextRunInUserTz.getFullYear();

    // Get the last day of the current month
    const lastDayOfCurrentMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();
    const targetDay = Math.min(dayOfMonth, lastDayOfCurrentMonth);

    // Check if we can still run this month
    if (
      currentDay < targetDay ||
      (currentDay === targetDay && isAfter(nextRunInUserTz, nowInUserTz))
    ) {
      nextRunInUserTz = set(nextRunInUserTz, { date: targetDay });
    } else {
      // Move to next month
      const nextMonth = currentMonth + 1;
      const nextMonthYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const actualNextMonth = nextMonth > 11 ? 0 : nextMonth;
      const lastDayOfNextMonth = new Date(
        nextMonthYear,
        actualNextMonth + 1,
        0
      ).getDate();
      const nextTargetDay = Math.min(dayOfMonth, lastDayOfNextMonth);

      nextRunInUserTz = set(nextRunInUserTz, {
        year: nextMonthYear,
        month: actualNextMonth,
        date: nextTargetDay,
      });
    }
  }

  // Daily frequency - just ensure we're in the future
  // Final check - ensure we're in the future
  while (!isAfter(nextRunInUserTz, nowInUserTz)) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // If forceNextRun is true, move to the next run
  if (forceNextRun) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // Convert from user's timezone to UTC timestamp
  const nextRunUtc = fromZonedTime(nextRunInUserTz, timezone);
  return nextRunUtc.getTime();
}

export function validateActiveProjects(plan: Plan, projects: ProjectInfo[]) {
  // Go through all the projects in 'docs' and count the max number of daily runs happening in a 30-Day period
  const maxDailyRuns = plan.settingsMaxDailyRuns;
  let totalDailyRuns = 0;
  let weekly: Record<number, number> = {};
  let monthly: Record<number, number> = {};

  projects.forEach((project) => {
    if (project.frequency === "daily") totalDailyRuns++;
    if (project.dayOfWeek !== undefined)
      weekly[project.dayOfWeek] = (weekly[project.dayOfWeek] || 0) + 1;
    if (project.dayOfMonth !== undefined)
      monthly[project.dayOfMonth] = (monthly[project.dayOfMonth] || 0) + 1;
  });

  const maxAllowedDailyRuns = maxDailyRuns - totalDailyRuns;
  if (maxAllowedDailyRuns < 0) {
    return false;
  }

  weekly = Object.fromEntries(
    Object.entries(weekly).filter(([_, v]) => v + totalDailyRuns > maxDailyRuns)
  );

  if (Object.keys(weekly).length > 0) {
    return false;
  }

  monthly = Object.fromEntries(
    Object.entries(monthly).filter(
      ([_, v]) => v + totalDailyRuns > maxDailyRuns
    )
  );

  if (Object.keys(monthly).length > 0) {
    return false;
  }

  return true;
}

async function getAllUserProjectsFromCache(
  app: any,
  userId: string,
  TTL?: any
): Promise<ProjectInfo[] | null> {
  const cachedProjects: any = await app.redis.get(userId);
  if (cachedProjects) {
    return JSON.parse(cachedProjects);
  }

  const projectsSnapshot = await app.db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .where("status", "!=", "deleted")
    .get();

  const projects = projectsSnapshot.docs.map((doc: any) => {
    const { userId: _userId, id: _id, ...data } = doc.data();
    return {
      ...data,
    };
  }) as ProjectInfo[];

  await app.redis.set(userId, JSON.stringify(projects));
  if (TTL) await app.redis.expire(userId, TTL);

  return projects;
}

// API key management routes: create/list/revoke. All routes rely on the auth
// plugin to populate req.userId and tenant authorization.
const routes: FastifyPluginAsync = async (app) => {
  const firebase = app.firebase;
  const db = firebase.db;
  const remoteConfig = firebase.remoteConfig;

  app.get("/healthz", async (_req, rep) => {
    return rep.send({ ok: true });
  });

  app.addHook("onClose", async () => {});

  // Secure project subscription via WebSockets
  app.get("/subscribe", { websocket: true }, (connection, req: any) => {
    const onConnectedClosed = async (userId: string) => {
      const unsubscribe = listeners.get(userId);
      unsubscribe?.();
      listeners.delete(userId);
      await app.redis.del(userId);
    };

    if (!connection) {
      req.reply.status(500).send({ error: "Connection failed" });
      return;
    }
    try {
      // Manually authenticate since preHandler doesn't run for websockets
      const idToken = req.query?.["token"] as string;
      app
        .introspectIdToken(idToken)
        .then(async (res) => {
          if (!res || !res?.user?.uid) {
            connection.send(JSON.stringify({ error: "Unauthenticated" }));
            connection.close();
            return;
          }
          const userId = res.user.uid;
          connection.send(JSON.stringify({ connected: true }));

          // sanity check -- safe
          if (listeners.has(userId)) {
            await onConnectedClosed(userId);
          }

          app.log.info("Setting up listener for user " + userId);
          // Set up Firestore listener
          const unsubscribe = await db
            .collection("users")
            .doc(userId)
            .collection("projects")
            .onSnapshot(
              async (snapshot: any) => {
                // get projects from snapshot
                let projects = snapshot.docs.map((doc: any) => {
                  const { userId: _userId, id: _id, ...data } = doc.data();
                  return {
                    ...data,
                  };
                });

                projects = projects.filter(
                  (project: any) => project.status !== "deleted"
                );

                // set cache
                await app.redis.set(userId, JSON.stringify(projects));
                connection.send(JSON.stringify({ projects }));
              },
              (err: any) => {
                app.log.error(err, "Firestore onSnapshot error");
                connection.send(
                  JSON.stringify({ error: "Internal server error" })
                );
              }
            );
          listeners.set(userId, unsubscribe);

          connection.on("close", async () => {
            console.log("WebSocket closed");
            await onConnectedClosed(userId);
          });
        })
        .catch((err) => {
          app.log.error(err, "WebSocket auth failed");
          connection.send(JSON.stringify({ error: "Authentication failed" }));
          connection.close();
        });
    } catch (error) {
      app.log.error(error, "WebSocket setup failed");
      connection.send(JSON.stringify({ error: "Internal server error" }));
      connection.close();
    }
  });

  app.get(
    "/list",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        }

        // check cache.. 99% of the time this will be hit
        const cachedProjects = await getAllUserProjectsFromCache(
          app,
          userId,
          60 * 5
        );

        return rep.status(200).send({
          projects: cachedProjects,
        } as ListProjectsResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/userProjects/list failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "User projects list failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );

  app.get(
    "/delivery-logs",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        }

        const projectId = (req.headers as any).projectid;
        if (!projectId) {
          return rep
            .status(400)
            .send({ error: { message: "Project ID is required" } });
        }

        // First find the project by title
        const projectDoc = await getProjectByTitle(userId, projectId);
        if (!projectDoc) {
          return rep.status(404).send({
            error: {
              message: "No project found with project id '" + projectId + "'",
            },
          });
        }

        // Parse pagination parameters
        const limit = Math.min(
          Math.max(parseInt((req.query as any).limit) || 5, 1),
          50
        );
        const offset = Math.max(parseInt((req.query as any).offset) || 0, 0);

        // Get total count for pagination info
        const allLogsSnapshot = await projectDoc.ref
          .collection("deliveryLogs")
          .count()
          .get();
        const total = allLogsSnapshot.data().count;

        // Now get the delivery logs for this specific project with pagination
        let query = projectDoc.ref
          .collection("deliveryLogs")
          .orderBy("researchCompletedAt", "desc");

        // Apply offset by fetching and skipping
        if (offset > 0) {
          const offsetSnapshot = await projectDoc.ref
            .collection("deliveryLogs")
            .orderBy("researchCompletedAt", "desc")
            .limit(offset)
            .get();
          if (!offsetSnapshot.empty) {
            const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
            query = query.startAfter(lastDoc);
          }
        }

        const deliveryLogsSnapshot = await query.limit(limit).get();

        const logs = deliveryLogsSnapshot.docs.map((doc: any) => {
          const {
            id,
            projectId,
            userId,
            destination,
            destinationAddress,
            stats,
            searchResultIds,
            ...data
          } = doc.data() as DeliveryLog;
          return data as RelevxDeliveryLog;
        });

        return rep.status(200).send({
          logs,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + logs.length < total,
          },
        } as ProjectDeliveryLogResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/userProjects/delivery-logs failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "User projects delivery logs failed to fetch",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );

  app.post(
    "/create",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        }

        const request = req.body as CreateProjectRequest;
        if (!request.projectInfo) {
          return rep
            .status(400)
            .send({ error: { message: "Project info is required" } });
        }

        // Check if project with same title already exists
        const existingProjectSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("projects")
          .where("title", "==", request.projectInfo.title)
          .get();

        if (!existingProjectSnapshot.empty) {
          return rep.status(400).send({
            error: { message: "Project with this title already exists" },
          });
        }

        const projectData: any = {
          ...request.projectInfo,
          userId,
          status: "draft", // New projects start as draft
          nextRunAt: calculateNewRunAt(
            request.projectInfo.frequency,
            request.projectInfo.deliveryTime,
            request.projectInfo.timezone,
            request.projectInfo.dayOfWeek,
            request.projectInfo.dayOfMonth
          ),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const projectRef = db
          .collection("users")
          .doc(userId)
          .collection("projects");
        await projectRef.add(projectData);

        const { userId: _userId, ...projectInfo } = projectData;

        return rep.status(200).send({
          project: projectInfo as ProjectInfo,
        } as CreateProjectResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/user/projects/create failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "User projects create failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );

  // Helper function to find a project document by title
  const getProjectByTitle = async (userId: string, title: string) => {
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("projects")
      .where("title", "==", title)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0];
  };

  /**
   * Update a user's project settings.
   * Special handling is performed if the project schedule (frequency, delivery time, etc.) is modified:
   * 1. Validates that the new schedule complies with the user's plan limits (max daily runs).
   * 2. Recalculates the `nextRunAt` timestamp.
   * 3. Prevents updates if the new run time is too close to the current time (within ~16 mins window) to avoid scheduling conflicts.
   */
  app.post(
    "/update",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        const { title, data } = req.body;
        if (!userId)
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        if (!title)
          return rep
            .status(400)
            .send({ error: { message: "Title is required" } });

        const doc = await getProjectByTitle(userId, title);
        if (!doc)
          return rep
            .status(404)
            .send({ error: { message: "Project not found" } });
        const docData = doc.data();
        const updates: any = {
          ...data,
          updatedAt: new Date().toISOString(),
        };

        // Check if any schedule-related fields are being updated
        const isScheduleChanged =
          data.deliveryTime ||
          data.frequency ||
          data.timezone ||
          data.dayOfWeek ||
          data.dayOfMonth;

        if (isScheduleChanged && docData.status === "active") {
          // Fetch all user projects to validate against plan limits
          let projects: ProjectInfo[] | null =
            await getAllUserProjectsFromCache(app, userId);

          if (projects) {
            projects = projects?.filter(
              (project) => project.status === "active"
            );

            // Temporarily update the current project in the list to test the new schedule configuration
            for (let project of projects) {
              if (project.title === title) {
                project.frequency = data.frequency || docData.frequency;
                project.deliveryTime =
                  data.deliveryTime || docData.deliveryTime;
                project.timezone = data.timezone || docData.timezone;
                project.dayOfWeek = data.dayOfWeek || docData.dayOfWeek;
                project.dayOfMonth = data.dayOfMonth || docData.dayOfMonth;
                break;
              }
            }

            const userData = await getUserData(userId, db);
            const plans: Plan[] = await getPlans(db);
            const plan: Plan | undefined = plans.find(
              (plan) => plan.id === userData.user.planId
            );

            // Validate that the new schedule allows the user to stay within their plan's limits
            if (plan && validateActiveProjects(plan, projects)) {
              const userAnalytics: AnalyticsDocument | null =
                await getUserAnalytics(db, userId);

              const forceNextRun =
                userAnalytics?.num_completed_daily_research_projects.find(
                  (item) => item === title
                );

              // Calculate the next run time based on the new schedule
              const newRunAt = calculateNewRunAt(
                data.frequency || docData.frequency,
                data.deliveryTime || docData.deliveryTime,
                data.timezone || docData.timezone,
                data.dayOfWeek || docData.dayOfWeek,
                data.dayOfMonth || docData.dayOfMonth,
                forceNextRun !== undefined
              );

              const now = Date.now();
              const currentUtcTime = fromZonedTime(now, "UTC").getTime();

              // Ensure we don't schedule a run too close to the current time (16 minute buffer)
              const projectWithinDeliveryWindow =
                newRunAt - currentUtcTime > 16 * 60 * 1000;
              if (projectWithinDeliveryWindow) {
                updates.nextRunAt = newRunAt;
              } else {
                return rep.status(400).send({
                  error: {
                    message: `Failed to update project. Please refrain from updating the project schedule too close to the current time (~16 min window).`,
                  },
                });
              }
            } else {
              return rep.status(400).send({
                error: {
                  message: `Failed to update project. Delivery settings are not valid. Please make sure settings align with your plan (max daily runs: ${plan?.settingsMaxDailyRuns}).`,
                },
              });
            }
          }
        }

        await doc.ref.update(updates);

        return rep.status(200).send({ ok: true });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/update failed");
        return rep
          .status(500)
          .send({ error: { message: "Failed to update project" } });
      }
    }
  );

  app.post(
    "/delete",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        const { title } = req.body;
        if (!userId)
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        if (!title)
          return rep
            .status(400)
            .send({ error: { message: "Title is required" } });

        const doc = await getProjectByTitle(userId, title);
        if (!doc)
          return rep
            .status(404)
            .send({ error: { message: "Project not found" } });

        // update cache after deletion
        await doc.ref.update({
          title: `[DELETED]:${title}`,
          status: "deleted",
          updatedAt: new Date().toISOString(),
        });

        return rep.status(200).send({ ok: true });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/delete failed");
        return rep
          .status(500)
          .send({ error: { message: "Failed to delete project" } });
      }
    }
  );

  /**
   * Toggle the status of a project (e.g., from "paused" to "active" or vice-versa).
   * Key logic:
   * 1. Checks if the project exists and belongs to the user.
   * 2. Prevents toggling if the project is currently "running" or in an "error" state.
   * 3. When activating a project ("active"), it validates that the user has not exceeded their plan's max daily runs.
   * 4. Updates the project status in Firestore if all checks pass.
   */
  app.post(
    "/toggle-status",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        const { title, status } = req.body;
        if (!userId)
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        if (!title)
          return rep
            .status(400)
            .send({ error: { message: "Title is required" } });

        // Retrieve current projects to check status and limits
        const projects: ProjectInfo[] | null =
          await getAllUserProjectsFromCache(app, userId, 60 * 5);
        const activeProjects = projects?.filter(
          (p: ProjectInfo) => p.status === "active"
        );

        const projectToToggle = projects?.find(
          (p: ProjectInfo) => p.title === title
        );
        if (!projectToToggle)
          return rep
            .status(404)
            .send({ error: { message: "Project not found" } });

        let nStatus: string = projectToToggle.status;
        let cStatus: string = nStatus;
        if (nStatus === status)
          return rep.status(400).send({
            error: { message: "Project status is already " + status },
          });

        let errorCode = "";
        let errorMessage = "";

        // Prevent toggling if project is in a transient or error state
        const allowToggle = nStatus !== "running" && nStatus !== "error";
        if (!allowToggle) {
          errorCode = "invalid_status";
          errorMessage = "Invalid status";
        }

        // If attempting to activate, we must validate plan limits
        const activateNewProject = status === "active" && allowToggle;
        if (activateNewProject) {
          const userData = await getUserData(userId, db);
          const isSubscribed = await isUserSubscribed(
            userData.user,
            app.stripe
          );

          // Find the user's correct plan.. if not on a plan assume they are on free mode
          const plans: Plan[] = await getPlans(remoteConfig);
          let plan: Plan | undefined = plans.find(
            (p) => p.infoName === "Free Trial"
          );
          if (isSubscribed) {
            plan = plans.find((p) => p.id === userData.user.planId);
          }

          if (plan) {
            // Simulate adding this project to the active list to check limits
            let newActivatedProjects: ProjectInfo[] = activeProjects
              ? [...activeProjects]
              : [];
            newActivatedProjects.push(projectToToggle);

            const allowToggle = validateActiveProjects(
              plan,
              newActivatedProjects
            );

            if (!allowToggle) {
              errorCode = "max_daily_runs";
              errorMessage =
                "User has reached the maximum number of daily runs. Please subscribe to a higher plan, if available.";
            } else {
              nStatus = status;
            }
          } else {
            errorCode = "user_plan_not_found";
            errorMessage = "Could not find users plan.";
          }
        }

        if (status === "paused") {
          nStatus = "paused";
        }

        // Apply update if status has changed
        if (nStatus !== cStatus) {
          app.log.info("Updating project status to " + nStatus);
          await db
            .collection("users")
            .doc(userId)
            .collection("projects")
            .where("title", "==", title)
            .limit(1)
            .get()
            .then((querySnapshot) => {
              querySnapshot.forEach((doc) => {
                doc.ref.update({
                  status: nStatus,
                  updatedAt: new Date().toISOString(),
                });
              });
            });
        }

        app.log.info({
          status: nStatus,
          errorCode,
          errorMessage,
        });
        return rep.status(200).send({
          status: nStatus,
          errorCode,
          errorMessage,
        });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/toggle-status failed");
        return rep
          .status(500)
          .send({ error: { message: "Failed to toggle status" } });
      }
    }
  );
};

export default routes;
