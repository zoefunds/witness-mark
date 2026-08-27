"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  readPromise,
  readPromiseCount,
  readPartyPromiseIds,
  readActivity,
  readPlatformStats,
  readReputation,
  readConfig,
} from "@/lib/genlayer";
import { isContractConfigured } from "@/lib/env";

export function usePromise(promiseId: number | undefined) {
  return useQuery({
    queryKey: ["promise", promiseId],
    queryFn: () => readPromise(promiseId as number),
    enabled: promiseId !== undefined && isContractConfigured(),
    retry: 1,
  });
}

export function usePromiseCount() {
  return useQuery({
    queryKey: ["promise-count"],
    queryFn: readPromiseCount,
    enabled: isContractConfigured(),
    retry: 1,
  });
}

export function usePartyPromiseIds(address: string | undefined) {
  return useQuery({
    queryKey: ["party-promise-ids", address],
    queryFn: () => readPartyPromiseIds(address as string),
    enabled: Boolean(address) && isContractConfigured(),
    retry: 1,
  });
}

export function useActivity(promiseId: number | undefined) {
  return useQuery({
    queryKey: ["activity", promiseId],
    queryFn: () => readActivity(promiseId as number, 0, 50),
    enabled: promiseId !== undefined && isContractConfigured(),
    retry: 1,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: readPlatformStats,
    enabled: isContractConfigured(),
    retry: 1,
  });
}

export function useReputation(address: string | undefined) {
  return useQuery({
    queryKey: ["reputation", address],
    queryFn: () => readReputation(address as string),
    enabled: Boolean(address) && isContractConfigured(),
    retry: 1,
  });
}

export function useMyPromises(address: string | undefined) {
  const idsQuery = usePartyPromiseIds(address);
  const ids = idsQuery.data ?? [];

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["promise", id],
      queryFn: () => readPromise(id),
      enabled: isContractConfigured(),
      retry: 1,
    })),
  });

  return {
    isLoading: idsQuery.isLoading || (ids.length > 0 && results.some((r) => r.isLoading)),
    isError: idsQuery.isError,
    error: idsQuery.error,
    promises: results.map((r) => r.data).filter(Boolean),
  };
}

export function useProtocolConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: readConfig,
    enabled: isContractConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
