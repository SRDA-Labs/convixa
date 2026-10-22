"use client";

import { useState, useCallback } from "react";

interface UseApiFormOptions<TData = unknown> {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  onSuccess?: (data: TData) => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for handling API form submissions with loading and error states.
 * Reduces boilerplate in components that make API calls.
 * 
 * @example
 * const { loading, error, submit, setError } = useApiForm({
 *   url: "/api/teams",
 *   method: "POST",
 *   onSuccess: () => router.refresh(),
 * });
 * 
 * const handleSubmit = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   await submit({ name: "My Team" });
 * };
 */
export function useApiForm<TData = unknown, TPayload = unknown>({
  url,
  method = "POST",
  onSuccess,
  onError,
}: UseApiFormOptions<TData>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(
    async (payload?: TPayload) => {
      setError("");
      setLoading(true);

      try {
        const res = await fetch(url, {
          method,
          headers: payload ? { "Content-Type": "application/json" } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
        });

        const data = (await res.json().catch(() => ({}))) as TData & { error?: string };

        if (!res.ok) {
          const errorMsg = data.error ?? `Failed to complete request (${res.status})`;
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        onSuccess?.(data);
        return { success: true, data };
      } catch (err) {
        const errorMsg = "Something went wrong. Please try again.";
        setError(errorMsg);
        onError?.(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [url, method, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError("");
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    setError,
    submit,
    reset,
  };
}

/**
 * Convenience hook for DELETE operations.
 * 
 * @example
 * const { loading, error, deleteItem } = useApiDelete({
 *   url: `/api/teams/${id}`,
 *   onSuccess: () => router.push("/dashboard/teams"),
 * });
 */
export function useApiDelete<TData = unknown>(
  options: Omit<UseApiFormOptions<TData>, "method">
) {
  const { submit, ...rest } = useApiForm<TData>({ ...options, method: "DELETE" });
  return { ...rest, deleteItem: submit };
}

/**
 * Convenience hook for GET operations.
 * 
 * @example
 * const { loading, error, data, fetch } = useApiFetch({
 *   url: "/api/teams",
 * });
 */
export function useApiFetch<TData = unknown>(
  options: Omit<UseApiFormOptions<TData>, "method">
) {
  const [data, setData] = useState<TData | null>(null);
  const { submit, ...rest } = useApiForm<TData>({
    ...options,
    method: "GET",
    onSuccess: (responseData) => {
      setData(responseData);
      options.onSuccess?.(responseData);
    },
  });

  return { ...rest, data, fetch: submit };
}
