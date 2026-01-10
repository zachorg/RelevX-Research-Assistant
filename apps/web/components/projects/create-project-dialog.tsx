"use client";

import React, { useState } from "react";
import { ProjectInfo, Frequency } from "core";
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
import { Sparkles, Calendar, ChevronDown, Settings } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects?: ProjectInfo[];
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  projects = [],
}: CreateProjectDialogProps) {
  const { createProject } = useProjects({ subscribe: false });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1); // 1st of month
  const [deliveryTime, setDeliveryTime] = useState("09:00");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [priorityDomains, setPriorityDomains] = useState("");
  const [excludedDomains, setExcludedDomains] = useState("");
  const [requiredKeywords, setRequiredKeywords] = useState("");
  const [excludedKeywords, setExcludedKeywords] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Helper function to parse comma-separated or newline-separated values
  const parseList = (value: string): string[] => {
    if (!value.trim()) return [];
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please enter a project title");
      return;
    }

    if (
      projects.some((p) => p.title.toLowerCase() === trimmedTitle.toLowerCase())
    ) {
      setError(
        `Project "${trimmedTitle}" already exists. Please choose a unique title.`
      );
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    setIsCreating(true);
    try {
      // Build searchParameters object if any fields are filled
      const searchParameters: any = {};
      const priorityDomainsList = parseList(priorityDomains);
      const excludedDomainsList = parseList(excludedDomains);
      const requiredKeywordsList = parseList(requiredKeywords);
      const excludedKeywordsList = parseList(excludedKeywords);

      if (priorityDomainsList.length > 0) {
        searchParameters.priorityDomains = priorityDomainsList;
      }
      if (excludedDomainsList.length > 0) {
        searchParameters.excludedDomains = excludedDomainsList;
      }
      if (requiredKeywordsList.length > 0) {
        searchParameters.requiredKeywords = requiredKeywordsList;
      }
      if (excludedKeywordsList.length > 0) {
        searchParameters.excludedKeywords = excludedKeywordsList;
      }

      const cprojectinfo: any =
      {
        title: title.trim(),
        description: description.trim(),
        frequency,
        resultsDestination: "email",
        deliveryTime,
        timezone,
        settings: {
          relevancyThreshold: 60,
          minResults: 5,
          maxResults: 20,
        }
      };

      if (frequency === "weekly") {
        cprojectinfo.dayOfWeek = dayOfWeek;
      }
      if (frequency === "monthly") {
        cprojectinfo.dayOfMonth = dayOfMonth;
      }

      await createProject({
        ...cprojectinfo,
        ...(Object.keys(searchParameters).length > 0 && { searchParameters }),
      });

      // Reset form and close dialog
      setTitle("");
      setDescription("");
      setFrequency("daily");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setDeliveryTime("09:00");
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setPriorityDomains("");
      setExcludedDomains("");
      setRequiredKeywords("");
      setExcludedKeywords("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create project:", err);
      setError("Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      // Reset form when closing
      if (!newOpen) {
        setTitle("");
        setDescription("");
        setFrequency("daily");
        setDayOfWeek(1);
        setDayOfMonth(1);
        setDeliveryTime("09:00");
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setPriorityDomains("");
        setExcludedDomains("");
        setRequiredKeywords("");
        setExcludedKeywords("");
        setError("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>Create New Project</DialogTitle>
          </div>
          <DialogDescription>
            Set up a new research project. Our AI will automatically search and
            deliver curated insights based on your schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Error Message - Fixed at top */}
          {error && (
            <div className="mx-1 mt-4 mb-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-6 py-4 px-1 overflow-y-auto flex-1">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Project Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., AI Research Updates"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                What to Research <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., Latest developments in AI and machine learning, focusing on practical applications and breakthrough research"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
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
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  disabled={isCreating}
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
                      disabled={isCreating}
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
                      disabled={isCreating}
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
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2 flex-1 min-w-[180px]">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={isCreating}
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
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {advancedOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                  {/* Priority Domains */}
                  <div className="space-y-2">
                    <Label htmlFor="priorityDomains">Priority Domains</Label>
                    <Textarea
                      id="priorityDomains"
                      placeholder="e.g., example.com, news.site.com"
                      value={priorityDomains}
                      onChange={(e) => setPriorityDomains(e.target.value)}
                      disabled={isCreating}
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
                    <Label htmlFor="excludedDomains">Excluded Domains</Label>
                    <Textarea
                      id="excludedDomains"
                      placeholder="e.g., spam-site.com, unreliable.com"
                      value={excludedDomains}
                      onChange={(e) => setExcludedDomains(e.target.value)}
                      disabled={isCreating}
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
                    <Label htmlFor="requiredKeywords">
                      Keywords to Search For
                    </Label>
                    <Textarea
                      id="requiredKeywords"
                      placeholder="e.g., machine learning, neural networks, AI"
                      value={requiredKeywords}
                      onChange={(e) => setRequiredKeywords(e.target.value)}
                      disabled={isCreating}
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
                    <Label htmlFor="excludedKeywords">Excluded Keywords</Label>
                    <Textarea
                      id="excludedKeywords"
                      placeholder="e.g., advertisement, sponsored, clickbait"
                      value={excludedKeywords}
                      onChange={(e) => setExcludedKeywords(e.target.value)}
                      disabled={isCreating}
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
