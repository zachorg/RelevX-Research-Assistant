"use client";

import React, { useState } from "react";
import type { Project } from "@/lib/projects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (projectId: string) => Promise<boolean>;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDelete,
}: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const success = await onDelete(project.id);
      if (success) {
        onOpenChange(false);
      } else {
        setError("Failed to delete project. Please try again.");
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle>Delete Project</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {project.title}
            </span>
            ? This action cannot be undone. All project data and history will be
            permanently removed.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
