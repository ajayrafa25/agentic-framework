import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { scoreFit } from "./fit.js";
import { buildSearchUrl, isNaukriJobUrl } from "./search.js";
import { JobStore } from "./store.js";
import { emptyProfile } from "./types.js";

test("builds a public Naukri search URL", () => {
  const url = buildSearchUrl({
    keywords: "Backend Engineer",
    location: "Bengaluru",
    experienceYears: 4,
    freshnessDays: 7,
  });
  assert.equal(
    url,
    "https://www.naukri.com/backend-engineer-jobs-in-bengaluru?k=Backend+Engineer&l=Bengaluru&experience=4&jobAge=7",
  );
});

test("accepts only naukri.com https links", () => {
  assert.equal(isNaukriJobUrl("https://www.naukri.com/job-listings-123"), true);
  assert.equal(isNaukriJobUrl("https://naukri.com/foo"), true);
  assert.equal(isNaukriJobUrl("http://www.naukri.com/foo"), false);
  assert.equal(isNaukriJobUrl("https://example.com/naukri"), false);
});

test("scores overlapping skills", () => {
  const profile = {
    ...emptyProfile(),
    skills: ["TypeScript", "Node.js"],
    preferredRoles: ["backend"],
    preferredLocations: ["Bengaluru"],
  };
  const fit = scoreFit(profile, {
    title: "Backend Engineer",
    description: "We need TypeScript and Kubernetes.",
    skills: ["TypeScript", "Kubernetes"],
    location: "Bengaluru",
  });
  assert.ok(fit.matchedSkills.includes("TypeScript"));
  assert.ok(fit.missingSkills.some((skill) => skill.toLowerCase() === "kubernetes"));
  assert.ok(fit.score > 0);
});

test("tracks a job until the user confirms they submitted it", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "naukri-mcp-"));
  try {
    const store = new JobStore(home);
    const job = await store.addJob({
      title: "Backend Engineer",
      company: "Example",
      url: "https://www.naukri.com/job-listings-example",
    });
    await assert.rejects(() => store.setStatus(job.id, "applied"), /confirm_submitted/);
    const applied = await store.confirmSubmitted(job.id, "User clicked Apply");
    assert.equal(applied.status, "applied");
    assert.equal(applied.userConfirmedSubmit, true);
    assert.ok(applied.appliedAt);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
