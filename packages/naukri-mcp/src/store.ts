import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  emptyProfile,
  type ApplicationDraft,
  type FitResult,
  type JobStatus,
  type Profile,
  type SavedJob,
  type StoreData,
} from "./types.js";

export function defaultHome(): string {
  return process.env.NAUKRI_MCP_HOME ?? path.join(homedir(), ".naukri-mcp");
}

function dataPath(home: string): string {
  return path.join(home, "data.json");
}

export class JobStore {
  constructor(private readonly home: string) {}

  async load(): Promise<StoreData> {
    try {
      const raw = await readFile(dataPath(this.home), "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      return {
        profile: { ...emptyProfile(), ...parsed.profile },
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { profile: emptyProfile(), jobs: [] };
      }
      throw error;
    }
  }

  async save(data: StoreData): Promise<void> {
    await mkdir(this.home, { recursive: true });
    const target = dataPath(this.home);
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2));
    await rename(temp, target);
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const data = await this.load();
    data.profile = { ...data.profile, ...stripUndefined(patch) };
    await this.save(data);
    return data.profile;
  }

  async addJob(input: {
    title: string;
    company: string;
    url: string;
    location?: string;
    experienceText?: string;
    description?: string;
    skills?: string[];
    notes?: string;
  }): Promise<SavedJob> {
    const data = await this.load();
    const now = new Date().toISOString();
    const existing = data.jobs.find((job) => job.url === input.url);
    if (existing) {
      existing.title = input.title;
      existing.company = input.company;
      existing.location = input.location ?? existing.location;
      existing.experienceText = input.experienceText ?? existing.experienceText;
      existing.description = input.description ?? existing.description;
      existing.skills = input.skills ?? existing.skills;
      existing.notes = input.notes ?? existing.notes;
      existing.updatedAt = now;
      await this.save(data);
      return existing;
    }

    const job: SavedJob = {
      id: randomUUID(),
      title: input.title,
      company: input.company,
      url: input.url,
      location: input.location ?? "",
      experienceText: input.experienceText ?? "",
      description: input.description ?? "",
      skills: input.skills ?? [],
      status: "saved",
      fit: null,
      draft: null,
      notes: input.notes ?? "",
      createdAt: now,
      updatedAt: now,
      appliedAt: null,
      userConfirmedSubmit: false,
    };
    data.jobs.unshift(job);
    await this.save(data);
    return job;
  }

  async getJob(id: string): Promise<SavedJob | undefined> {
    const data = await this.load();
    return data.jobs.find((job) => job.id === id);
  }

  async listJobs(status?: JobStatus): Promise<SavedJob[]> {
    const data = await this.load();
    return status ? data.jobs.filter((job) => job.status === status) : data.jobs;
  }

  async setFit(id: string, fit: FitResult): Promise<SavedJob> {
    return this.patch(id, { fit });
  }

  async setDraft(id: string, draft: ApplicationDraft): Promise<SavedJob> {
    return this.patch(id, { draft, status: "drafted" });
  }

  async setStatus(id: string, status: JobStatus, notes?: string): Promise<SavedJob> {
    if (status === "applied") {
      throw new Error(
        "Use confirm_submitted after you click Apply on Naukri. This server cannot submit an application.",
      );
    }
    return this.patch(id, {
      status,
      notes,
    });
  }

  async confirmSubmitted(id: string, note?: string): Promise<SavedJob> {
    const now = new Date().toISOString();
    return this.patch(id, {
      status: "applied",
      appliedAt: now,
      userConfirmedSubmit: true,
      notes: note,
    });
  }

  private async patch(
    id: string,
    patch: Partial<Omit<SavedJob, "id" | "createdAt">>,
  ): Promise<SavedJob> {
    const data = await this.load();
    const job = data.jobs.find((item) => item.id === id);
    if (!job) throw new Error(`No saved job with id ${id}`);
    Object.assign(job, stripUndefined(patch), { updatedAt: new Date().toISOString() });
    await this.save(data);
    return job;
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
