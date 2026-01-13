"use client";

import React, { useState, useEffect } from "react";
import type { ProjectInfo, Frequency, ImproveProjectDescriptionRequest, ImproveProjectDescriptionResponse } from "core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { DayOfWeekPicker } from "@/components/ui/day-of-week-picker";
import { DayOfMonthPicker } from "@/components/ui/day-of-month-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, Calendar, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { relevx_api } from "@/lib/client";

interface EditProjectSettingsDialogProps {
  project: ProjectInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectSettingsDialog({
  project,
  open,
  onOpenChange,
}: EditProjectSettingsDialogProps) {
  const { updateProject } = useProjects({ subscribe: false });

  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [frequency, setFrequency] = useState<Frequency>(project.frequency);
  const [dayOfWeek, setDayOfWeek] = useState<number>(project.dayOfWeek ?? 1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(project.dayOfMonth ?? 1); // 1st of month
  const [deliveryTime, setDeliveryTime] = useState(
    project.deliveryTime || "09:00"
  );
  const [timezone, setTimezone] = useState(
    project.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [priorityDomains, setPriorityDomains] = useState("");
  const [excludedDomains, setExcludedDomains] = useState("");
  const [requiredKeywords, setRequiredKeywords] = useState("");
  const [excludedKeywords, setExcludedKeywords] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Helper function to convert array to comma-separated string
  const arrayToString = (arr: string[] | undefined): string => {
    return arr ? arr.join(", ") : "";
  };

  // Helper function to parse comma-separated or newline-separated values
  const parseList = (value: string): string[] => {
    if (!value.trim()) return [];
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleEnhanceDescription = async () => {
    if (!description.trim() || isEnhancing) return;

    setIsEnhancing(true);
    try {
      const request: ImproveProjectDescriptionRequest = {
        description: description.trim() || "research project",
      };
      const response = await relevx_api.post<ImproveProjectDescriptionResponse>(
        "/api/v1/ai/improve-project-description",
        request as any
      );
      if (response.description) {
        setDescription(response.description);
      }
    } catch (err) {
      console.error("Failed to enhance description:", err);
      setError("Failed to enhance description. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Reset form when project changes or dialog opens
  useEffect(() => {
    if (open) {
      setTitle(project.title);
      setDescription(project.description);
      setFrequency(project.frequency);
      setDayOfWeek(project.dayOfWeek ?? 1);
      setDayOfMonth(project.dayOfMonth ?? 1);
      setDeliveryTime(project.deliveryTime || "09:00");
      setTimezone(
        project.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setPriorityDomains(
        arrayToString(project.searchParameters?.priorityDomains)
      );
      setExcludedDomains(
        arrayToString(project.searchParameters?.excludedDomains)
      );
      setRequiredKeywords(
        arrayToString(project.searchParameters?.requiredKeywords)
      );
      setExcludedKeywords(
        arrayToString(project.searchParameters?.excludedKeywords)
      );
      setError("");
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!title.trim()) {
      setError("Please enter a project title");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    setIsUpdating(true);
    try {
      // Build searchParameters object
      const priorityDomainsList = parseList(priorityDomains);
      const excludedDomainsList = parseList(excludedDomains);
      const requiredKeywordsList = parseList(requiredKeywords);
      const excludedKeywordsList = parseList(excludedKeywords);

      const searchParameters: any = {
        ...project.searchParameters,
      };

      if (priorityDomainsList.length > 0) {
        searchParameters.priorityDomains = priorityDomainsList;
      } else {
        delete searchParameters.priorityDomains;
      }

      if (excludedDomainsList.length > 0) {
        searchParameters.excludedDomains = excludedDomainsList;
      } else {
        delete searchParameters.excludedDomains;
      }

      if (requiredKeywordsList.length > 0) {
        searchParameters.requiredKeywords = requiredKeywordsList;
      } else {
        delete searchParameters.requiredKeywords;
      }

      if (excludedKeywordsList.length > 0) {
        searchParameters.excludedKeywords = excludedKeywordsList;
      } else {
        delete searchParameters.excludedKeywords;
      }

      const updateData: any = {
        title: title.trim(),
        description: description.trim(),
        frequency,
        resultsDestination: "email",
        deliveryTime,
        timezone,
        ...(frequency === "weekly" && { dayOfWeek }),
        ...(frequency === "monthly" && { dayOfMonth }),
        // Clear the other day field when switching frequencies
        ...(frequency === "daily" && { dayOfWeek: null, dayOfMonth: null }),
        ...(frequency === "weekly" && { dayOfMonth: null }),
        ...(frequency === "monthly" && { dayOfWeek: null }),
      };

      // Only include searchParameters if it has any properties or we need to clear it
      if (
        Object.keys(searchParameters).length > 0 ||
        project.searchParameters
      ) {
        updateData.searchParameters = searchParameters;
      }

      const success = await updateProject(project.title, updateData);

      if (success) {
        onOpenChange(false);
      } else {
        setError("Failed to update project. Please try again.");
      }
    } catch (err) {
      console.error("Failed to update project:", err);
      setError("Failed to update project. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>Project Settings</DialogTitle>
          </div>
          <DialogDescription>
            Update your project settings. Changes will take effect on the next
            scheduled research run.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-6 py-4 px-1 overflow-y-auto flex-1">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                Project Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                placeholder="e.g., AI Research Updates"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUpdating}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-description">
                  What to Research <span className="text-destructive">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleEnhanceDescription}
                        disabled={isUpdating || isEnhancing}
                      >
                        {isEnhancing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enhance with AI</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                id="edit-description"
                placeholder="e.g., Latest developments in AI and machine learning, focusing on practical applications and breakthrough research"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUpdating}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what you want to track. The more detailed, the
                better the results.
              </p>
            </div>

            {/* Schedule Card */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Schedule
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label htmlFor="edit-frequency">Frequency</Label>
                <Select
                  id="edit-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  disabled={isUpdating}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>

              {/* Scheduling Options Row */}
              <div className="flex flex-wrap items-start gap-4">
                {/* Day of Week (for weekly frequency) */}
                {frequency === "weekly" && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <DayOfWeekPicker
                      value={dayOfWeek}
                      onChange={setDayOfWeek}
                      disabled={isUpdating}
                    />
                  </div>
                )}

                {/* Day of Month (for monthly frequency) */}
                {frequency === "monthly" && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <DayOfMonthPicker
                      value={dayOfMonth}
                      onChange={setDayOfMonth}
                      disabled={isUpdating}
                    />
                  </div>
                )}

                {/* Placeholder for daily to maintain consistent layout */}
                {frequency === "daily" && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Repeats</Label>
                    <div className="h-[120px] w-32 flex items-center justify-center text-sm text-muted-foreground bg-muted/50 rounded-md border border-dashed border-border">
                      Every day
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Time</Label>
                  <TimePicker
                    value={deliveryTime}
                    onChange={setDeliveryTime}
                    disabled={isUpdating}
                  />
                </div>

                <div className="space-y-2 flex-1 min-w-[180px]">
                  <Label htmlFor="edit-timezone">Timezone</Label>
                  <Select
                    id="edit-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={isUpdating}
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">
                      Pacific Time (PT)
                    </option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Paris (CET/CEST)</option>
                    <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
                    <option value="Australia/Melbourne">
                      Melbourne (AEDT/AEST)
                    </option>
                    <option value="Pacific/Auckland">
                      Auckland (NZDT/NZST)
                    </option>
                    <option value="UTC">UTC</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Advanced Settings Collapsible */}
            <div className="rounded-lg border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Advanced Settings
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {advancedOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                  {/* Priority Domains */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-priorityDomains">
                      Priority Domains
                    </Label>
                    <Textarea
                      id="edit-priorityDomains"
                      placeholder="e.g., example.com, news.site.com"
                      value={priorityDomains}
                      onChange={(e) => setPriorityDomains(e.target.value)}
                      disabled={isUpdating}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Domains to prioritize in search results (one per line or
                      comma-separated). We will prioritize content from these
                      domains.
                    </p>
                  </div>

                  {/* Excluded Domains */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-excludedDomains">
                      Excluded Domains
                    </Label>
                    <Textarea
                      id="edit-excludedDomains"
                      placeholder="e.g., spam-site.com, unreliable.com"
                      value={excludedDomains}
                      onChange={(e) => setExcludedDomains(e.target.value)}
                      disabled={isUpdating}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Domains to exclude from search results (one per line or
                      comma-separated). Results from these domains will be
                      filtered out.
                    </p>
                  </div>

                  {/* Required Keywords */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-requiredKeywords">
                      Keywords to Search For
                    </Label>
                    <Textarea
                      id="edit-requiredKeywords"
                      placeholder="e.g., machine learning, neural networks, AI"
                      value={requiredKeywords}
                      onChange={(e) => setRequiredKeywords(e.target.value)}
                      disabled={isUpdating}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Keywords to include in searches to improve result quality
                      (one per line or comma-separated). These will be used to
                      enhance search queries.
                    </p>
                  </div>

                  {/* Excluded Keywords */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-excludedKeywords">
                      Excluded Keywords
                    </Label>
                    <Textarea
                      id="edit-excludedKeywords"
                      placeholder="e.g., advertisement, sponsored, clickbait"
                      value={excludedKeywords}
                      onChange={(e) => setExcludedKeywords(e.target.value)}
                      disabled={isUpdating}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Keywords to exclude from results (one per line or
                      comma-separated). Content containing these keywords will
                      be filtered out.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
