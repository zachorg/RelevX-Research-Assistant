"use client";

import React, { useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import type { ProjectInfo } from "core";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MoreVertical, Settings, Trash2, Clock, Calendar } from "lucide-react";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { EditProjectSettingsDialog } from "./edit-project-settings-dialog";
import { ProjectDetailModal } from "./project-detail-modal";
import { DAY_OF_WEEK_LABELS, formatDayOfMonth } from "@/lib/utils";

interface ProjectCardProps {
  project: ProjectInfo;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { toggleProjectStatus, deleteProject } = useProjects({
    subscribe: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  const frequencyLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  const getFrequencyDisplay = () => {
    const baseLabel = frequencyLabels[project.frequency];
    if (project.frequency === "weekly" && project.dayOfWeek !== undefined) {
      return `${baseLabel} (${DAY_OF_WEEK_LABELS[project.dayOfWeek]})`;
    }
    if (project.frequency === "monthly" && project.dayOfMonth !== undefined) {
      return `${baseLabel} (${formatDayOfMonth(project.dayOfMonth)})`;
    }
    return baseLabel;
  };

  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const newStatus = project.status === "active" ? "paused" : "active";
      if (newStatus !== project.status) {
        await toggleProjectStatus(project.title, newStatus);
      }
    } catch (err: any) {
      console.error("Failed to toggle project status:", err);
      // Check if it's a ProjectError with custom code
      if (err.errorCode) {
        setErrorDialog({
          open: true,
          title: "Action Failed",
          message: err.errorMessage || "An unexpected error occurred.",
        });
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest('[role="switch"]') ||
      target.closest('[role="menu"]') ||
      target.closest("[data-radix-collection-item]")
    ) {
      return;
    }
    setDetailModalOpen(true);
  };

  return (
    <>
      <Card
        className={`group hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 glass-dark h-full flex flex-col cursor-pointer ${
          project.status === "running" ? "!border-red-500 !border-2" : ""
        }`}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  checked={
                    project.status === "active" || project.status === "running"
                  }
                  onCheckedChange={handleToggleActive}
                  disabled={isToggling}
                />
              </div>
              <CardTitle className="text-xl mb-2 line-clamp-2">
                {project.title}
              </CardTitle>
            </div>

            {/* 3-Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (project.status === "running") {
                      setErrorDialog({
                        open: true,
                        title: "Edit Restricted",
                        message:
                          "The project is currently being processed, edit is not allowed while a research is in progress.",
                      });
                      return;
                    }
                    setSettingsDialogOpen(true);
                  }}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardDescription className="line-clamp-3">
            {project.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Frequency:</span>
              <span className="font-medium">{getFrequencyDisplay()}</span>
            </div>

            {project.deliveryTime && project.timezone && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium">
                  {formatTime12Hour(project.deliveryTime)}{" "}
                  {project.timezone.split("/")[1]?.replace(/_/g, " ") ||
                    project.timezone}
                </span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              Created {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteProjectDialog
        project={project}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={deleteProject}
      />

      {/* Edit Settings Dialog */}
      <EditProjectSettingsDialog
        project={project}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={project}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      <Dialog
        open={errorDialog.open}
        onOpenChange={(open: boolean) =>
          setErrorDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{errorDialog.title}</DialogTitle>
            <DialogDescription>{errorDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() =>
                setErrorDialog((prev) => ({ ...prev, open: false }))
              }
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
