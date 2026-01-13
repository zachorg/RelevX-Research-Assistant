"use strict";
/**
 * Project CRUD service
 *
 * Handles all Firestore operations for projects.
 * Uses subcollection pattern: users/{userId}/projects/{projectId}
 * Works with both Admin SDK (server) and Client SDK (browser)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectError = void 0;
exports.createProject = createProject;
exports.listProjects = listProjects;
exports.subscribeToProjects = subscribeToProjects;
exports.updateProjectStatus = updateProjectStatus;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.getProjectDeliveryLogs = getProjectDeliveryLogs;
const client_1 = require("@/lib/client");
let socket_connection_statis = "disconnected";
/**
 * Create a new project for a user
 */
async function createProject(data) {
    try {
        // Set default settings if not provided
        const settings = data.settings || {
            relevancyThreshold: 60,
            minResults: 5,
            maxResults: 20,
        };
        const projectData = {
            title: data.title,
            description: data.description,
            frequency: data.frequency,
            resultsDestination: data.resultsDestination,
            deliveryTime: data.deliveryTime,
            timezone: data.timezone,
            searchParameters: data.searchParameters,
            settings,
            deliveryConfig: data.deliveryConfig,
            dayOfWeek: data.dayOfWeek,
            dayOfMonth: data.dayOfMonth,
        };
        const request = {
            projectInfo: projectData,
        };
        const response = await client_1.relevx_api.post(`/api/v1/user/projects/create`, {
            ...request,
        });
        if (!response) {
            throw new Error("Failed to create project");
        }
        return response.project;
    }
    catch (error) {
        console.error("Error creating project:", error);
        throw error;
    }
}
/**
 * List all projects for a user (one-time fetch)
 */
async function listProjects() {
    const response = await client_1.relevx_api.get(`/api/v1/user/projects/list`);
    if (!response) {
        throw new Error("Failed to list projects");
    }
    return response.projects;
}
/**
 * Subscribe to projects for a user (real-time updates)
 * Returns an unsubscribe function
 */
function subscribeToProjects(callback) {
    // We use the backend WebSocket for real-time updates
    // Authentication is handled by passing the token in the query or first message
    if (socket_connection_statis !== "disconnected")
        return () => { };
    let socket = null;
    let isClosed = false;
    const connect = async () => {
        socket_connection_statis = "connecting";
        try {
            if (isClosed)
                return;
            const auth = require("./firebase").auth;
            const idToken = await auth.currentUser?.getIdToken(true);
            // Get base URL from environment or fallback
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000";
            const wsUrl = baseUrl.replace(/^http/, "ws") + "/api/v1/user/projects/subscribe";
            // Fastify-websocket expects the token. We'll send it as a protocol or query param
            // or just rely on the session if cookies are used. But here we use Bearer.
            // Fastify-websocket doesn't easily support custom headers in browser WebSocket API.
            // We'll use a query parameter for the token.
            socket = new WebSocket(`${wsUrl}?token=${idToken}`);
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.connected) {
                        socket_connection_statis = "connected";
                        console.log("WebSocket connected");
                    }
                    else if (data.projects) {
                        console.log("WebSocket projects:", data.projects);
                        let projects = data.projects;
                        if (typeof projects === "string") {
                            try {
                                projects = JSON.parse(projects);
                            }
                            catch (e) {
                                console.error("Error parsing projects string:", e);
                            }
                        }
                        callback(projects);
                    }
                    else if (data.error) {
                        console.error("WebSocket error message:", data.error);
                    }
                }
                catch (err) {
                    console.error("Error parsing WebSocket message:", err);
                }
            };
            socket.onclose = () => {
                socket_connection_statis = "disconnected";
                if (!isClosed) {
                    setTimeout(connect, 3000);
                }
            };
            socket.onerror = (err) => {
                socket_connection_statis = "disconnected";
                console.error("WebSocket error:", err);
                socket?.close();
            };
        }
        catch (err) {
            socket_connection_statis = "disconnected";
            console.error("Failed to connect to WebSocket:", err);
            setTimeout(connect, 5000);
        }
    };
    connect();
    return () => {
        isClosed = true;
        socket?.close();
    };
}
// Custom error class to propagate structured backend errors to the UI
class ProjectError extends Error {
    errorCode;
    errorMessage;
    constructor(message, errorCode, errorMessage) {
        super(message);
        this.name = "ProjectError";
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }
}
exports.ProjectError = ProjectError;
/**
 * Update project status
 */
async function updateProjectStatus(projectTitle, status) {
    const response = await client_1.relevx_api.post("/api/v1/user/projects/toggle-status", {
        title: projectTitle,
        status,
    });
    if (!response) {
        throw new Error("Failed to update project status");
    }
    if (response.errorCode) {
        throw new ProjectError(response.errorMessage || "Error updating project", response.errorCode, response.errorMessage);
    }
    return response.status === status;
}
/**
 * Update project execution tracking after a research run
 */
// export async function updateProjectExecution(
//   userId: string,
//   projectId: string,
//   updates: {
//     status?: ProjectStatus;
//     lastRunAt?: number;
//     nextRunAt?: number;
//     lastError?: string;
//   },
//   dbInstance?: any,
//   isAdminSDK?: boolean
// ): Promise<void> {
//   // This is typically called from the backend/worker, so it might still use Firestore directly
//   // or we can add a route for it. For now, let's keep it if it's Admin SDK.
//   if (isAdminSDK) {
//     const projectRef = getProjectRef(userId, projectId, dbInstance, isAdminSDK);
//     const updateData = {
//       ...updates,
//       updatedAt: Date.now(),
//     };
//     await projectRef.update(updateData);
//     return;
//   }
//   // If called from client, we should use the update route
//   // Note: we'd need the title here too.
//   throw new Error("updateProjectExecution should only be called by Admin SDK");
// }
/**
 * Update a project with partial data
 */
async function updateProject(projectTitle, data) {
    const title = projectTitle;
    const response = await client_1.relevx_api.post("/api/v1/user/projects/update", {
        title,
        data,
    });
    if (!response) {
        throw new Error("Failed to update project");
    }
}
/**
 * Delete a project
 */
async function deleteProject(projectTitle) {
    const title = projectTitle;
    const response = await client_1.relevx_api.post("/api/v1/user/projects/delete", {
        title,
    });
    if (!response) {
        throw new Error("Failed to delete project");
    }
}
/**
 * Get delivery logs for a project
 */
async function getProjectDeliveryLogs(projectTitle, limit = 5, offset = 0) {
    try {
        const response = await client_1.relevx_api.get(`/api/v1/user/projects/delivery-logs?limit=${limit}&offset=${offset}`, { projectId: projectTitle });
        if (!response) {
            throw new Error("Failed to fetch delivery logs");
        }
        return response;
    }
    catch (error) {
        // Return empty result for 404 (no logs yet)
        if (error?.status === 404) {
            return {
                logs: [],
                pagination: { total: 0, limit, offset, hasMore: false },
            };
        }
        throw error;
    }
}
//# sourceMappingURL=projects.js.map