import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { metaAPI } from "../api";
import type { IMetaQuery, IMetaResponse } from "../types";

/**
 * Fetches /api/v1/meta for the given filter.
 *
 * queryKey includes the full filter object so different builds get distinct
 * cache entries. Inherits staleTime (5 min) / retry (1) /
 * refetchOnWindowFocus (false) from the QueryClientProvider defaults in
 * App.tsx.
 *
 * Returns `data: undefined` until the first fetch completes.
 * Use `isLoading` to gate UI rendering; use `error` to surface failures.
 */
export function useMetaData(
  query: IMetaQuery,
): UseQueryResult<IMetaResponse, Error> {
  return useQuery({
    queryKey: ["meta", query],
    queryFn: () => metaAPI.fetchMeta(query),
    // className is required by the backend; don't fire a 400 from the UI.
    enabled: typeof query.className === "string" && query.className.length > 0,
  });
}
