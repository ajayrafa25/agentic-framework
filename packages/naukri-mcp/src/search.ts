export type SearchInput = {
  keywords: string;
  location?: string;
  experienceYears?: number;
  freshnessDays?: number;
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Public Naukri search pages a person opens in a browser.
 * These are ordinary site URLs, not private job-apply endpoints.
 */
export function buildSearchUrl(input: SearchInput): string {
  const keywords = input.keywords.trim();
  const location = input.location?.trim() ?? "";
  const keywordSlug = slugify(keywords);
  const locationSlug = slugify(location);

  const path = locationSlug
    ? `https://www.naukri.com/${keywordSlug}-jobs-in-${locationSlug}`
    : `https://www.naukri.com/${keywordSlug}-jobs`;

  const params = new URLSearchParams();
  params.set("k", keywords);
  if (location) params.set("l", location);
  if (input.experienceYears !== undefined) {
    params.set("experience", String(input.experienceYears));
  }
  if (input.freshnessDays !== undefined) {
    params.set("jobAge", String(input.freshnessDays));
  }
  return `${path}?${params.toString()}`;
}

export function isNaukriJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return host === "naukri.com" && parsed.protocol === "https:";
  } catch {
    return false;
  }
}
