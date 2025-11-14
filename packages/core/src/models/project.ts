/**
 * Project data model
 *
 * Represents a research project that the user wants to track.
 */

export type Frequency = "daily" | "weekly" | "monthly";

export type ResultsDestination = "email" | "slack" | "none";

/**
 * Full project type as stored in Firestore
 */
export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  frequency: Frequency;
  resultsDestination: ResultsDestination;
  createdAt: number;
  updatedAt: number;
}

/**
 * Project data needed to create a new project
 * (omits auto-generated fields)
 */
export interface NewProject
  extends Omit<Project, "id" | "createdAt" | "updatedAt"> {}
