import type { FastifyPluginAsync } from "fastify";
import type {
  ProjectInfo,
  ListProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectStatus,
  Plan,
  Project,
  RelevxDeliveryLog,
  DeliveryLog,
  ProjectDeliveryLogResponse,
} from "core";
import { Frequency } from "core";
import { set, isAfter, add } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { isUserSubscribed } from "../utils/billing.js";
import { getUserData } from "../utils/user.js";
import { Redis } from "ioredis";

const REDIS_EXPIRE_TIME_IN_SECONDS = 60 * 5;
const listeners = new Map<string, () => void>();
const connections = new Map<string, any>();

// 1. Create a dedicated subscriber connection
// We don't use the main fastify.redis because it's busy with GET/SET
const subscriber = new Redis(process.env.REDIS_URL || "");

subscriber.on("error", (err) => console.log("Redis Client Error", err));

// 2. Enable Notifications (Safety check)
// This ensures the Docker container is actually emitting events
await subscriber.config("SET", "notify-keyspace-events", "Ex");

// 3. Subscribe to the expiration channel
await subscriber.subscribe("__keyevent@0__:expired");

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
 * Calculate the next run timestamp based on frequency, delivery time, and timezone
 * @param frequency - daily, weekly, or monthly
 * @param deliveryTime - HH:MM format in user's timezone
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param lastRunAt - Optional timestamp of last execution
 * @returns Timestamp (milliseconds) for next execution
 */
function calculateNextRunAt(
  frequency: Frequency,
  deliveryTime: string,
  timezone: string
  // lastRunAt?: number
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

  // If we've already passed the delivery time today, move to the next period
  if (!isAfter(nextRunInUserTz, nowInUserTz)) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // Apply frequency rules - ensure we're in the future
  while (!isAfter(nextRunInUserTz, nowInUserTz)) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // Convert from user's timezone to UTC timestamp
  const nextRunUtc = fromZonedTime(nextRunInUserTz, timezone);
  return nextRunUtc.getTime();
}

// API key management routes: create/list/revoke. All routes rely on the auth
// plugin to populate req.userId and tenant authorization.
const routes: FastifyPluginAsync = async (app) => {
  const firebase = app.firebase;
  const db = firebase.db;

  app.get("/healthz", async (_req, rep) => {
    return rep.send({ ok: true });
  });

  // 4. Handle the event
  subscriber.on("message", async (_channel: any, key: any) => {
    console.log(`Redis: Item with key "${key}" has expired!`);
    const unsubscribe = listeners.get(key);
    unsubscribe?.();
    listeners.delete(key);
  });

  app.addHook("onClose", async () => {
    await subscriber.quit();
  });

  // Secure project subscription via WebSockets
  app.get("/subscribe", { websocket: true }, (connection, req: any) => {
    const onConnectedClosed = async (userId: string) => {
      connections.delete(userId);
      await app.redis.expire(userId, REDIS_EXPIRE_TIME_IN_SECONDS);
    };
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
          connections.set(userId, connection);

          // check redis to see if user has cached data
          let valid = await app.redis.get(userId);
          if (valid) {
            await app.redis.persist(userId);

            // retrieve again for safe-fail
            valid = await app.redis.get(userId);
            if (valid) {
              app.log.info("Sending cached projects to user " + userId);
              // Send the cached value
              connection?.send(
                JSON.stringify({
                  projects: JSON.parse(valid),
                })
              );
            }
          }

          if (!valid) {
            // set redis key -- cache the value
            const projectSnapshot = await db
              .collection("users")
              .doc(userId)
              .collection("projects")
              .get();

            const projects = projectSnapshot.docs.map((doc: any) => {
              const { userId: _userId, id: _id, ...data } = doc.data();
              return {
                ...data,
              };
            });
            await app.redis.set(userId, JSON.stringify(projects));
          }

          if (!listeners.has(userId)) {
            app.log.info("Setting up listener for user " + userId);
            // Set up Firestore listener
            const unsubscribe = db
              .collection("users")
              .doc(userId)
              .collection("projects")
              .onSnapshot(
                async (snapshot: any) => {
                  const cachedProjectString = await app.redis.get(userId);
                  if (!cachedProjectString) {
                    // projects
                    app.log.error(
                      "Redis key has not yet been set before setting up listener for user " +
                        userId
                    );
                    return;
                  }
                  const cachedProjects: ProjectInfo[] =
                    JSON.parse(cachedProjectString);

                  // get projects from snapshot
                  const projects = snapshot.docs.map((doc: any) => {
                    const { userId: _userId, id: _id, ...data } = doc.data();
                    return {
                      ...data,
                    };
                  });

                  const uniqueProjects = new Map<string, any>();
                  cachedProjects.forEach((project: any) => {
                    // Use a Map to store the key (title) and value (project object)
                    uniqueProjects.set(project.title, project);
                  });
                  projects.forEach((project: any) => {
                    // Use a Map to store the key (title) and value (project object)
                    uniqueProjects.set(project.title, project);
                  });

                  await app.redis.set(
                    userId,
                    JSON.stringify(Array.from(uniqueProjects.values()))
                  );

                  connections.get(userId)?.send(
                    JSON.stringify({
                      projects,
                    })
                  );
                },
                (err: any) => {
                  app.log.error(err, "Firestore onSnapshot error");
                  connections
                    .get(userId)
                    ?.send(JSON.stringify({ error: "Internal server error" }));
                }
              );
            listeners.set(userId, unsubscribe);
          }

          connection?.on("close", async () => {
            console.log("WebSocket closed");
            onConnectedClosed(userId);
          });
        })
        .catch((err) => {
          app.log.error(err, "WebSocket auth failed");
          connection?.send(JSON.stringify({ error: "Authentication failed" }));
          connection?.close();
        });
    } catch (error) {
      app.log.error(error, "WebSocket setup failed");
      connection?.send(JSON.stringify({ error: "Internal server error" }));
      connection?.close();
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

        // Create or update user document in Firestore
        const projectsSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("projects")
          .orderBy("createdAt", "desc")
          .get();
        if (projectsSnapshot.empty) {
          return rep
            .status(404)
            .send({ error: { message: "No projects found" } });
        }

        const projects = projectsSnapshot.docs.map((doc: any) => {
          const { userId: _userId, id: _id, ...data } = doc.data();
          return {
            ...data,
          };
        }) as ProjectInfo[];

        return rep.status(200).send({
          projects,
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

        const projectData = {
          ...request.projectInfo,
          userId,
          status: "draft", // New projects start as draft
          nextRunAt: calculateNextRunAt(
            request.projectInfo.frequency,
            request.projectInfo.deliveryTime,
            request.projectInfo.timezone
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

  const getAllProjectsWithStatus = async (
    userId: string,
    status: ProjectStatus
  ) => {
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("projects")
      .where("status", "==", status as any as string)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs;
  };

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

        await doc.ref.update({
          ...data,
          updatedAt: new Date().toISOString(),
        });

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

        await doc.ref.delete();
        return rep.status(200).send({ ok: true });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/delete failed");
        return rep
          .status(500)
          .send({ error: { message: "Failed to delete project" } });
      }
    }
  );

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

        const doc = await getProjectByTitle(userId, title);
        if (!doc)
          return rep
            .status(404)
            .send({ error: { message: "Project not found" } });

        let nStatus: string = doc.data().status;
        let cStatus: string = nStatus;
        if (nStatus === status)
          return rep.status(400).send({
            error: { message: "Project status is already " + status },
          });

        let errorCode = "";
        let errorMessage = "";

        const allowToggle = nStatus !== "running" && nStatus !== "error";
        if (!allowToggle) {
          errorCode = "invalid_status";
          errorMessage = "Invalid status";
        }
        const activateNewProject = status === "active" && allowToggle;
        if (activateNewProject) {
          const userData = await getUserData(userId, db);
          const isSubscribed = await isUserSubscribed(
            userData.user,
            app.stripe
          );
          if (!isSubscribed) {
            errorCode = "invalid_subscription";
            errorMessage = "User is not subscribed";
          } else {
            app.log.info("User is subscribed");
            const docs = await getAllProjectsWithStatus(userId, "active");
            if (!docs) {
              nStatus = status;
            }
            if (docs) {
              const plansRef = db.collection("plans").doc(userData.user.planId);
              const plansDoc = await plansRef.get();
              const plansData = plansDoc.data() as Plan;

              // Go through all the projects in 'docs' and count the max number of daily runs happening in a 30-Day period
              let totalDailyRuns = 0;
              docs.forEach((doc) => {
                const data: Project = doc.data() as Project;
                if (data.frequency === "daily") totalDailyRuns++;
              });
              const maxDailyRuns = plansData.settingsMaxDailyRuns;
              if (totalDailyRuns >= maxDailyRuns) {
                errorCode = "max_daily_runs";
                errorMessage =
                  "User has reached the maximum number of daily runs. Please subscribe to a higher plan, if available.";
              } else {
                nStatus = status;
              }
            }
          }
        }

        if (status === "paused") {
          nStatus = "paused";
        }

        if (nStatus !== cStatus) {
          app.log.info("Updating project status to " + nStatus);
          await doc.ref.update({
            status: nStatus,
            updatedAt: new Date().toISOString(),
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
