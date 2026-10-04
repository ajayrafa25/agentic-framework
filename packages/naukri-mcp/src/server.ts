import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scoreFit } from "./fit.js";
import { buildSearchUrl, isNaukriJobUrl } from "./search.js";
import { JobStore } from "./store.js";
import { JOB_STATUSES, type JobStatus, type Profile } from "./types.js";

const BOUNDARY =
  "This server never logs into Naukri and never submits an application. Naukri does not publish a job-seeker apply API. Open the returned https://www.naukri.com URL and click Apply yourself, then call confirm_submitted.";

function text(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

const profileShape = {
  fullName: z.string().optional(),
  headline: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  currentLocation: z.string().optional(),
  totalExperienceYears: z.number().min(0).max(60).nullable().optional(),
  skills: z.array(z.string()).optional(),
  summary: z.string().optional(),
  resumeHighlights: z.array(z.string()).optional(),
  preferredRoles: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  noticePeriod: z.string().optional(),
  currentCtc: z.string().optional(),
  expectedCtc: z.string().optional(),
};

export function createServer(store: JobStore): McpServer {
  const server = new McpServer({
    name: "naukri-apply",
    version: "0.1.0",
  });

  server.registerTool(
    "get_profile",
    {
      description:
        "Read the local job-seeker profile used to compare Naukri jobs and draft answers. Nothing is sent to Naukri.",
      inputSchema: {},
    },
    async () => {
      const data = await store.load();
      return text({ profile: data.profile, boundary: BOUNDARY });
    },
  );

  server.registerTool(
    "update_profile",
    {
      description:
        "Save profile fields locally (skills, summary, locations, notice period, CTC text). Do not store a Naukri password.",
      inputSchema: profileShape,
    },
    async (patch) => {
      const profile = await store.updateProfile(patch as Partial<Profile>);
      return text({ profile });
    },
  );

  server.registerTool(
    "build_search_links",
    {
      description:
        "Build public Naukri search page URLs for the user to open in a browser. Does not fetch or scrape Naukri.",
      inputSchema: {
        keywords: z.string().min(1),
        location: z.string().optional(),
        experienceYears: z.number().int().min(0).max(50).optional(),
        freshnessDays: z.number().int().min(1).max(30).optional(),
      },
    },
    async (input) => {
      const url = buildSearchUrl(input);
      return text({
        url,
        instruction:
          "Give this link to the user. They search on Naukri, pick a job, and paste the job URL plus description back into chat.",
      });
    },
  );

  server.registerTool(
    "save_job",
    {
      description:
        "Save a Naukri job the user found. Requires an https://www.naukri.com job URL. Does not apply.",
      inputSchema: {
        title: z.string().min(1),
        company: z.string().min(1),
        url: z.string().url(),
        location: z.string().optional(),
        experienceText: z.string().optional(),
        description: z.string().optional(),
        skills: z.array(z.string()).optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => {
      if (!isNaukriJobUrl(input.url)) {
        throw new Error("url must be an https://www.naukri.com or https://naukri.com link");
      }
      const job = await store.addJob(input);
      return text({ job, boundary: BOUNDARY });
    },
  );

  server.registerTool(
    "score_job",
    {
      description:
        "Compare a saved job with the local profile and store a skill-overlap score. The chat model should explain the result in plain language.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const data = await store.load();
      const job = data.jobs.find((item) => item.id === id);
      if (!job) throw new Error(`No saved job with id ${id}`);
      const fit = scoreFit(data.profile, job);
      const updated = await store.setFit(id, fit);
      return text({ job: updated, guidance: "Recommend apply only when the user agrees. Then prepare a draft." });
    },
  );

  server.registerTool(
    "save_draft",
    {
      description:
        "Store a draft the chat model wrote for a saved job: a short why-me note and answers to recruiter questions. Does not submit them.",
      inputSchema: {
        id: z.string().min(1),
        whyMe: z.string().min(1),
        answers: z
          .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
          .default([]),
      },
    },
    async ({ id, whyMe, answers }) => {
      const job = await store.setDraft(id, {
        whyMe,
        answers,
        updatedAt: new Date().toISOString(),
      });
      return text({
        job,
        next: "Call prepare_apply_packet and have the user submit on the Naukri page.",
      });
    },
  );

  server.registerTool(
    "prepare_apply_packet",
    {
      description:
        "Return the Naukri job URL, profile facts, and saved draft so the user can fill the apply form. Marks the job ready_for_you. Does not click Apply.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const data = await store.load();
      const current = data.jobs.find((item) => item.id === id);
      if (!current) throw new Error(`No saved job with id ${id}`);
      const job =
        current.status === "applied" || current.status === "interview" || current.status === "offer"
          ? current
          : await store.setStatus(id, "ready_for_you");
      return text({
        boundary: BOUNDARY,
        openThisUrl: job.url,
        profile: data.profile,
        draft: job.draft,
        checklist: [
          "Open the job URL while logged into your own Naukri account.",
          "Click Apply yourself.",
          "Paste the draft answers only where the form asks for them.",
          "After Naukri shows the application as submitted, tell the assistant to call confirm_submitted.",
        ],
      });
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description: "List locally tracked Naukri jobs, optionally filtered by status.",
      inputSchema: {
        status: z.enum(JOB_STATUSES).optional(),
      },
    },
    async ({ status }) => {
      const jobs = await store.listJobs(status as JobStatus | undefined);
      return text({
        count: jobs.length,
        jobs: jobs.map((job) => ({
          id: job.id,
          title: job.title,
          company: job.company,
          status: job.status,
          score: job.fit?.score ?? null,
          url: job.url,
          appliedAt: job.appliedAt,
        })),
      });
    },
  );

  server.registerTool(
    "get_job",
    {
      description: "Read one locally saved job, including fit score and draft.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const job = await store.getJob(id);
      if (!job) throw new Error(`No saved job with id ${id}`);
      return text(job);
    },
  );

  server.registerTool(
    "update_job_status",
    {
      description:
        "Update a local status such as interview, offer, rejected, or withdrawn. Cannot set applied; use confirm_submitted after the user applies on Naukri.",
      inputSchema: {
        id: z.string().min(1),
        status: z.enum(JOB_STATUSES),
        notes: z.string().optional(),
      },
    },
    async ({ id, status, notes }) => {
      const job = await store.setStatus(id, status as JobStatus, notes);
      return text(job);
    },
  );

  server.registerTool(
    "confirm_submitted",
    {
      description:
        "Record that the user personally submitted this application on Naukri. Call only after the user says they clicked Apply and Naukri accepted it.",
      inputSchema: {
        id: z.string().min(1),
        note: z.string().optional(),
      },
    },
    async ({ id, note }) => {
      const job = await store.confirmSubmitted(id, note);
      return text({
        job,
        recorded: "Marked applied because the user confirmed they submitted it on Naukri.",
      });
    },
  );

  return server;
}
