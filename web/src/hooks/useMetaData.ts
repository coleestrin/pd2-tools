import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { metaAPI } from "../api";
import type { IMetaQuery, IMetaResponse } from "../types";

export function useMetaData(
  query: IMetaQuery,
): UseQueryResult<IMetaResponse, Error> {
  return useQuery({
    queryKey: ["meta", query],
    queryFn: () => metaAPI.fetchMeta(query),
    enabled: typeof query.className === "string" && query.className.length > 0,
  });
}
