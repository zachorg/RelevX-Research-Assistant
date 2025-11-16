/**
 * Project CRUD service
 *
 * Handles all Firestore operations for projects.
 * Uses subcollection pattern: users/{userId}/projects/{projectId}
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project, NewProject, ProjectStatus } from "../models/project";

/**
 * Get the projects collection reference for a user
 */
function getProjectsCollection(userId: string) {
  return collection(db, "users", userId, "projects");
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRunAt(frequency: "daily" | "weekly" | "monthly"): number {
  const now = new Date();
  
  switch (frequency) {
    case "daily":
      // Next day at 8 AM UTC
      now.setUTCDate(now.getUTCDate() + 1);
      now.setUTCHours(8, 0, 0, 0);
      break;
    case "weekly":
      // Next Monday at 8 AM UTC
      const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
      now.setUTCDate(now.getUTCDate() + daysUntilMonday);
      now.setUTCHours(8, 0, 0, 0);
      break;
    case "monthly":
      // 1st of next month at 8 AM UTC
      now.setUTCMonth(now.getUTCMonth() + 1);
      now.setUTCDate(1);
      now.setUTCHours(8, 0, 0, 0);
      break;
  }
  
  return now.getTime();
}

/**
 * Create a new project for a user
 */
export async function createProject(
  userId: string,
  data: Omit<NewProject, "userId">
): Promise<Project> {
  try {
    const now = Date.now();
    
    // Set default settings if not provided
    const settings = data.settings || {
      relevancyThreshold: 60,
      minResults: 5,
      maxResults: 20,
    };
    
    const projectData: Omit<Project, "id"> = {
      userId,
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      resultsDestination: data.resultsDestination,
      searchParameters: data.searchParameters,
      settings,
      deliveryConfig: data.deliveryConfig,
      status: "draft", // New projects start as draft
      nextRunAt: calculateNextRunAt(data.frequency),
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(getProjectsCollection(userId), projectData);

    return {
      id: docRef.id,
      ...projectData,
    };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

/**
 * List all projects for a user (one-time fetch)
 */
export async function listProjects(userId: string): Promise<Project[]> {
  try {
    const q = query(
      getProjectsCollection(userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Project[];
  } catch (error) {
    console.error("Error listing projects:", error);
    throw error;
  }
}

/**
 * Subscribe to projects for a user (real-time updates)
 * Returns an unsubscribe function
 */
export function subscribeToProjects(
  userId: string,
  callback: (projects: Project[]) => void
): () => void {
  const q = query(getProjectsCollection(userId), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];
      callback(projects);
    },
    (error) => {
      console.error("Error subscribing to projects:", error);
    }
  );
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  userId: string,
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  try {
    const projectRef = doc(db, "users", userId, "projects", projectId);
    await updateDoc(projectRef, {
      status,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error updating project status:", error);
    throw error;
  }
}

/**
 * Update project execution tracking after a research run
 */
export async function updateProjectExecution(
  userId: string,
  projectId: string,
  updates: {
    status?: ProjectStatus;
    lastRunAt?: number;
    nextRunAt?: number;
    lastError?: string;
  }
): Promise<void> {
  try {
    const projectRef = doc(db, "users", userId, "projects", projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error updating project execution:", error);
    throw error;
  }
}

/**
 * Activate a project (change from draft to active)
 */
export async function activateProject(
  userId: string,
  projectId: string
): Promise<void> {
  try {
    const projectRef = doc(db, "users", userId, "projects", projectId);
    await updateDoc(projectRef, {
      status: "active",
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error activating project:", error);
    throw error;
  }
}
