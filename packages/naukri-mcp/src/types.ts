export const JOB_STATUSES = [
  "saved",
  "drafted",
  "ready_for_you",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type Profile = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  currentLocation: string;
  totalExperienceYears: number | null;
  skills: string[];
  summary: string;
  resumeHighlights: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
};

export type SavedJob = {
  id: string;
  title: string;
  company: string;
  url: string;
  location: string;
  experienceText: string;
  description: string;
  skills: string[];
  status: JobStatus;
  fit: FitResult | null;
  draft: ApplicationDraft | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  userConfirmedSubmit: boolean;
};

export type ApplicationDraft = {
  whyMe: string;
  answers: { question: string; answer: string }[];
  updatedAt: string;
};

export type FitResult = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  notes: string[];
};

export type StoreData = {
  profile: Profile;
  jobs: SavedJob[];
};

export function emptyProfile(): Profile {
  return {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    currentLocation: "",
    totalExperienceYears: null,
    skills: [],
    summary: "",
    resumeHighlights: [],
    preferredRoles: [],
    preferredLocations: [],
    noticePeriod: "",
    currentCtc: "",
    expectedCtc: "",
  };
}
