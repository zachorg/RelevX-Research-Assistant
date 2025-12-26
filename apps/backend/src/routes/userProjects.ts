import type { FastifyPluginAsync } from "fastify";
import type { ProjectInfo, ListProjectsResponse, CreateProjectRequest, CreateProjectResponse } from "core";
import { Frequency } from "core";
import { set, isAfter, add } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { isUserSubscribed } from "../utils/billing.js";
import { getUserData } from "../utils/user.js";

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
  timezone: string,
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

  // Secure project subscription via WebSockets
  app.get(
    "/subscribe",
    { websocket: true },
    (connection, req: any) => {
      try {
        // Manually authenticate since preHandler doesn't run for websockets
        const idToken = req.query?.["token"] as string;
        app.introspectIdToken(idToken).then((res) => {
          if (!res?.user?.uid) {
            connection.send(JSON.stringify({ error: "Unauthenticated" }));
            connection.close();
            return;
          }
          const userId = res.user.uid;

          connection.send(JSON.stringify({ connected: true }));

          // Set up Firestore listener
          const unsubscribe = db
            .collection("users")
            .doc(userId)
            .collection("projects")
            .orderBy("createdAt", "desc")
            .onSnapshot(
              (snapshot: any) => {
                const projects = snapshot.docs.map((doc: any) => {
                  const { userId: _userId, id: _id, ...data } = doc.data();
                  return {
                    ...data,
                  };
                });
                connection?.send(JSON.stringify({ projects }));
              },
              (err: any) => {
                app.log.error(err, "Firestore onSnapshot error");
                connection?.send(JSON.stringify({ error: "Internal server error" }));
              }
            );

          connection?.on("close", () => {
            console.log("WebSocket closed");
            unsubscribe();
          });
        }).catch((err) => {
          app.log.error(err, "WebSocket auth failed");
          if (connection) {
            connection?.send(JSON.stringify({ error: "Authentication failed" }));
            connection?.close();
          }
        });


      } catch (error) {
        app.log.error(error, "WebSocket setup failed");
        if (connection) {
          connection?.send(JSON.stringify({ error: "Internal server error" }));
          connection?.close();
        }
      }
    }
  );

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
        const projectsSnapshot = await db.collection("users").doc(userId).collection("projects").orderBy("createdAt", "desc")
          .get();
        if (projectsSnapshot.empty) {
          return rep.status(404).send({ error: { message: "No projects found" } });
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
          return rep
            .status(400)
            .send({ error: { message: "Project with this title already exists" } });
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

        const projectRef = db.collection("users").doc(userId).collection("projects");
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

  app.post(
    "/update",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        const { title, data } = req.body;
        if (!userId) return rep.status(401).send({ error: { message: "Unauthenticated" } });
        if (!title) return rep.status(400).send({ error: { message: "Title is required" } });

        const doc = await getProjectByTitle(userId, title);
        if (!doc) return rep.status(404).send({ error: { message: "Project not found" } });

        await doc.ref.update({
          ...data,
          updatedAt: new Date().toISOString()
        });

        return rep.status(200).send({ ok: true });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/update failed");
        return rep.status(500).send({ error: { message: "Failed to update project" } });
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
        if (!userId) return rep.status(401).send({ error: { message: "Unauthenticated" } });
        if (!title) return rep.status(400).send({ error: { message: "Title is required" } });

        const doc = await getProjectByTitle(userId, title);
        if (!doc) return rep.status(404).send({ error: { message: "Project not found" } });

        await doc.ref.delete();
        return rep.status(200).send({ ok: true });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/delete failed");
        return rep.status(500).send({ error: { message: "Failed to delete project" } });
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
        if (!userId) return rep.status(401).send({ error: { message: "Unauthenticated" } });
        if (!title) return rep.status(400).send({ error: { message: "Title is required" } });

        const doc = await getProjectByTitle(userId, title);
        if (!doc) return rep.status(404).send({ error: { message: "Project not found" } });

        let cStatus = doc.data().status;
        if (cStatus === status) return rep.status(400).send({ error: { message: "Project status is already " + status } });

        let errorCode = "";
        let errorMessage = "";

        const allowToggle = (cStatus !== "running" && cStatus !== "error");
        if (!allowToggle) {
          errorCode = "invalid_status";
          errorMessage = "Invalid status";
        }
        const activateNewProject = status === "active" && allowToggle;
        if (activateNewProject) {
          const userData = await getUserData(userId, db);
          const isSubscribed = await isUserSubscribed(userData.user, app.stripe);
          if (!isSubscribed) {
            errorCode = "invalid_subscription";
            errorMessage = "User is not subscribed";
          }
          else {
            console.log("User is subscribed");
            // @TODO: Make sure subscription plan allows for this project to be active based on its config.
            cStatus = status;
          }
        }

        if (cStatus !== status) {
          await doc.ref.update({
            status: cStatus,
            updatedAt: new Date().toISOString()
          });
        }

        console.log({
          status: cStatus,
          errorCode,
          errorMessage
        });
        return rep.status(200).send({
          status: cStatus,
          errorCode,
          errorMessage
        });
      } catch (err: any) {
        req.log?.error(err, "/user/projects/toggle-status failed");
        return rep.status(500).send({ error: { message: "Failed to toggle status" } });
      }
    }
  );
};

export default routes;

