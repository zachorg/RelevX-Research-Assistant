/**
 * Core package entry point
 *
 * Exports all shared business logic, types, and hooks.
 */

// Models
export type {
  Project,
  NewProject,
  Frequency,
  ResultsDestination,
} from "./models/project";

// Services
export { auth, db } from "./services/firebase";
export { signInWithGoogle, signOut } from "./services/auth";
export {
  createProject,
  listProjects,
  subscribeToProjects,
} from "./services/projects";

// Hooks
export { useAuth } from "./hooks/useAuth";
export { useProjects } from "./hooks/useProjects";
