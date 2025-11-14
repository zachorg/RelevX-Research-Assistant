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
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project, NewProject } from "../models/project";

/**
 * Get the projects collection reference for a user
 */
function getProjectsCollection(userId: string) {
  return collection(db, "users", userId, "projects");
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
    const projectData = {
      userId,
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      resultsDestination: data.resultsDestination,
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
