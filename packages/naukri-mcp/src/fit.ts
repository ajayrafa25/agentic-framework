import type { FitResult, Profile } from "./types.js";

const STOP = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "to",
  "in",
  "for",
  "with",
  "on",
  "or",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "be",
  "this",
  "that",
  "your",
  "you",
  "our",
  "we",
  "job",
  "role",
  "years",
  "year",
  "experience",
]);

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP.has(part));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function scoreFit(profile: Profile, job: {
  title: string;
  description: string;
  skills: string[];
  location: string;
}): FitResult {
  const profileSkills = unique(profile.skills.map((skill) => skill.trim()).filter(Boolean));
  const jobSkills = unique([
    ...job.skills,
    ...tokens(job.title).filter((token) => token.length > 2),
  ]);
  const description = `${job.title}\n${job.description}`.toLowerCase();

  const matchedSkills = profileSkills.filter((skill) => {
    const needle = skill.toLowerCase();
    return (
      jobSkills.some((jobSkill) => jobSkill.toLowerCase() === needle) ||
      description.includes(needle)
    );
  });

  const missingSkills = jobSkills.filter((skill) => {
    const needle = skill.toLowerCase();
    return !profileSkills.some((profileSkill) => profileSkill.toLowerCase() === needle);
  });

  const skillScore =
    jobSkills.length === 0
      ? profileSkills.length > 0
        ? 40
        : 0
      : Math.round((matchedSkills.length / Math.max(jobSkills.length, 1)) * 70);

  const notes: string[] = [];
  let bonus = 0;

  const location = job.location.toLowerCase();
  if (
    location &&
    profile.preferredLocations.some((item) => location.includes(item.toLowerCase()))
  ) {
    bonus += 15;
    notes.push("Location matches a preferred location.");
  } else if (location) {
    notes.push("Location is outside the preferred locations on the profile.");
  }

  const title = job.title.toLowerCase();
  if (profile.preferredRoles.some((role) => title.includes(role.toLowerCase()))) {
    bonus += 15;
    notes.push("Title matches a preferred role.");
  }

  if (!profile.summary && profile.resumeHighlights.length === 0) {
    notes.push("Add a summary or resume highlights before drafting answers.");
  }
  if (matchedSkills.length === 0) {
    notes.push("No profile skills showed up in this job text.");
  }

  return {
    score: Math.min(100, skillScore + bonus),
    matchedSkills,
    missingSkills: missingSkills.slice(0, 12),
    notes,
  };
}
