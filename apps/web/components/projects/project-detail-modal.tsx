"use client";

import React, { useState } from "react";
import type { ProjectInfo } from "core";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Settings,
  History,
  Clock,
  Mail,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useDeliveryLogs } from "@/hooks/use-delivery-logs";
import { EditProjectSettingsDialog } from "./edit-project-settings-dialog";

type TabId = "overview" | "settings" | "history";

interface ProjectDetailModalProps {
  project: ProjectInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailModal({
  project,
  open,
  onOpenChange,
}: ProjectDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
    },
    {
      id: "history",
      label: "Delivery History",
      icon: <History className="w-4 h-4" />,
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{project.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {project.status === "active" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-500 font-medium">
                        Active
                      </span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Paused
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-border/50 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "overview" && <OverviewTab project={project} />}
            {activeTab === "settings" && (
              <SettingsTab
                project={project}
                onEditClick={() => setSettingsDialogOpen(true)}
              />
            )}
            {activeTab === "history" && (
              <DeliveryHistoryTab projectTitle={project.title} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <EditProjectSettingsDialog
        project={project}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </>
  );
}

// Overview Tab Component
function OverviewTab({ project }: { project: ProjectInfo }) {
  const frequencyLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  const destinationLabels = {
    email: "Email",
    slack: "Slack",
    sms: "SMS",
    none: "In-App Only",
  };

  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  const formatNextRun = (timestamp: number | undefined) => {
    if (!timestamp) return "Not scheduled";
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Research Topic
        </h3>
        <p className="text-foreground">{project.description}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Frequency</span>
          </div>
          <p className="font-semibold">{frequencyLabels[project.frequency]}</p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Delivery Time</span>
          </div>
          <p className="font-semibold">
            {project.deliveryTime
              ? formatTime12Hour(project.deliveryTime)
              : "Not set"}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Delivery Method
            </span>
          </div>
          <p className="font-semibold">
            {destinationLabels[project.resultsDestination]}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Next Run</span>
          </div>
          <p className="font-semibold text-sm">
            {formatNextRun(project.nextRunAt)}
          </p>
        </div>
      </div>

      {/* Created/Updated Info */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
        {project.updatedAt && (
          <span>
            Last updated: {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  project,
  onEditClick,
}: {
  project: ProjectInfo;
  onEditClick: () => void;
}) {
  const arrayToDisplay = (arr: string[] | undefined): string => {
    return arr && arr.length > 0 ? arr.join(", ") : "None configured";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Project Settings</h3>
        <Button onClick={onEditClick}>
          <Settings className="w-4 h-4 mr-2" />
          Edit Settings
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Search Parameters */}
        <div className="p-4 rounded-lg border border-border/50">
          <h4 className="font-medium mb-3">Search Parameters</h4>
          <div className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Priority Domains:</span>
              <p className="mt-1">
                {arrayToDisplay(project.searchParameters?.priorityDomains)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Excluded Domains:</span>
              <p className="mt-1">
                {arrayToDisplay(project.searchParameters?.excludedDomains)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Required Keywords:</span>
              <p className="mt-1">
                {arrayToDisplay(project.searchParameters?.requiredKeywords)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Excluded Keywords:</span>
              <p className="mt-1">
                {arrayToDisplay(project.searchParameters?.excludedKeywords)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delivery History Tab Component
function DeliveryHistoryTab({ projectTitle }: { projectTitle: string }) {
  const { logs, loading, error, pagination, page, goToNextPage, goToPrevPage } =
    useDeliveryLogs(projectTitle);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedLogIndex(expandedLogIndex === index ? null : index);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "Delivered";
      case "failed":
        return "Failed";
      case "partial":
        return "Partial";
      case "pending":
        return "Pending";
      default:
        return status;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Delivery History</h3>
        <p className="text-muted-foreground">
          This project hasn&apos;t completed any research runs yet.
          <br />
          Results will appear here after the first scheduled run.
        </p>
      </div>
    );
  }

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Past Deliveries</h3>
        <span className="text-sm text-muted-foreground">
          {pagination
            ? `${pagination.total} total`
            : `${logs.length} deliveries`}
        </span>
      </div>

      <div className="space-y-3">
        {logs.map((log, index) => (
          <div
            key={index}
            className="border border-border/50 rounded-lg overflow-hidden"
          >
            {/* Log Header */}
            <button
              onClick={() => toggleExpand(index)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(log.status)}
                <div>
                  <p className="font-medium">{log.reportTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(log.researchCompletedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    log.status === "success"
                      ? "bg-green-500/10 text-green-500"
                      : log.status === "failed"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {getStatusLabel(log.status)}
                </span>
                {expandedLogIndex === index ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {expandedLogIndex === index && (
              <div className="border-t border-border/50 p-4 bg-muted/20">
                {/* Summary */}
                {log.reportSummary && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      {log.reportSummary}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {log.error && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{log.error}</p>
                  </div>
                )}

                {/* Report Content */}
                {log.reportMarkdown && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Report</h4>
                    <div className="max-h-[400px] overflow-y-auto p-4 rounded-lg bg-background border border-border/50">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {log.reportMarkdown}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Research Started:
                    </span>
                    <p>{formatDate(log.researchStartedAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <p>{formatDate(log.researchCompletedAt)}</p>
                  </div>
                  {log.retryCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">
                        Retry Attempts:
                      </span>
                      <p>{log.retryCount}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={page === 0}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={!pagination.hasMore}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
