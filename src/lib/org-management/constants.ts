/** Canonical path for org user/team/multisig management. */
export const ORG_HUB_PATH = "/dashboard/teams";

export function orgHubUrl(tab?: string, params?: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  if (tab) search.set("tab", tab);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${ORG_HUB_PATH}?${query}` : ORG_HUB_PATH;
}
