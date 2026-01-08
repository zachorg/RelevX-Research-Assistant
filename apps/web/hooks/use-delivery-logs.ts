/**
 * useDeliveryLogs hook
 *
 * Fetches delivery logs for a specific project with pagination.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  RelevxDeliveryLog,
  PaginationInfo,
} from "../../../packages/core/src/models/delivery-log";
import { getProjectDeliveryLogs } from "../lib/projects";
import { useAuth } from "../contexts/auth-context";

const PAGE_SIZE = 5;

interface UseDeliveryLogsResult {
  logs: RelevxDeliveryLog[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  page: number;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  refetch: () => Promise<void>;
}

export function useDeliveryLogs(
  projectTitle: string | null
): UseDeliveryLogsResult {
  const { user } = useAuth();
  const [logs, setLogs] = useState<RelevxDeliveryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(0);

  const fetchLogs = useCallback(async () => {
    if (!user?.uid || !projectTitle) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const offset = page * PAGE_SIZE;
      const result = await getProjectDeliveryLogs(
        projectTitle,
        PAGE_SIZE,
        offset
      );
      setLogs(result.logs);
      setPagination(result.pagination ?? null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch delivery logs";
      setError(errorMessage);
      setLogs([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, projectTitle, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const goToNextPage = useCallback(() => {
    if (pagination?.hasMore) {
      setPage((p) => p + 1);
    }
  }, [pagination?.hasMore]);

  const goToPrevPage = useCallback(() => {
    if (page > 0) {
      setPage((p) => p - 1);
    }
  }, [page]);

  return {
    logs,
    loading,
    error,
    pagination,
    page,
    goToNextPage,
    goToPrevPage,
    refetch: fetchLogs,
  };
}
