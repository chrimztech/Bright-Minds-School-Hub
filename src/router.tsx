import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

// Most pages destructure only `data` from useQuery and never check `isError`, so a denied
// request previously just rendered as a silently empty list/table — indistinguishable from
// "there's genuinely nothing here" for both the admin who forgot to grant a permission and
// the user who was denied. This surfaces it without touching every page individually.
// Deduped per page load (not per failing query) since several parallel queries commonly
// 403 together when a page's permission is missing.
let lastPermissionToastAt = 0;
function handleQueryError(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status !== 403) return;
  const now = Date.now();
  if (now - lastPermissionToastAt < 2000) return;
  lastPermissionToastAt = now;
  toast.error("You don't have permission to view this.");
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleQueryError }),
    defaultOptions: {
      queries: {
        // A 403 (or any 4xx) will never succeed on retry — the default 3-retry backoff was
        // delaying the permission-denied toast above by several seconds, and just wasting
        // requests against a server that already gave a definitive answer.
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (status !== undefined && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
