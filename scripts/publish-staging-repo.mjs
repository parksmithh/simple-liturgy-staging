#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { syncStagingTree } from "./sync-staging-tree.mjs";

// GitHub's git smart HTTP rejects Authorization: Bearer (401, www-authenticate: Basic).
// Basic with username x-access-token is the scheme actions/checkout uses.
const AUTH_KEY = "http.https://github.com/.extraheader";

export function stagingAuthorizationHeader(token) {
  const basic = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  return `AUTHORIZATION: basic ${basic}`;
}

export function redactStagingAuth(text, token) {
  const encoded = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  return String(text).split(encoded).join("***").split(token).join("***");
}

export function stagingGitEnv(token, baseEnv = process.env) {
  const parsed = Number(baseEnv.GIT_CONFIG_COUNT || "0");
  const count = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  return {
    ...baseEnv,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: String(count + 1),
    [`GIT_CONFIG_KEY_${count}`]: AUTH_KEY,
    [`GIT_CONFIG_VALUE_${count}`]: stagingAuthorizationHeader(token),
  };
}

function runGit(token, args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: stagingGitEnv(token),
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    output: redactStagingAuth(`${result.stdout || ""}${result.stderr || ""}`, token),
  };
}

function git(token, args, cwd) {
  const result = runGit(token, args, cwd);
  if (result.status !== 0) throw new Error(result.output.trim() || `git ${args[0]} failed`);
  return result.output;
}

async function main() {
  const token = (process.env.STAGING_REPO_TOKEN || "").trim();
  const repository = process.env.STAGING_REPOSITORY || "parksmithh/simple-liturgy-staging";

  if (!token) {
    console.error("STAGING_REPO_TOKEN is not set. Refusing to publish.");
    process.exit(1);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    console.error("STAGING_REPOSITORY must be owner/name.");
    process.exit(1);
  }

  const dest = await mkdtemp(join(tmpdir(), "simple-liturgy-staging-"));
  try {
    const url = `https://github.com/${repository}.git`;
    const clone = runGit(token, ["clone", "--depth", "1", "--branch", "main", url, dest], tmpdir());
    if (clone.status !== 0) {
      const empty = /Remote branch main not found|empty repository/i.test(clone.output);
      if (!empty) throw new Error(clone.output.trim() || "git clone failed");
      await rm(dest, { recursive: true, force: true });
      git(token, ["init", "-b", "main", dest], tmpdir());
      git(token, ["remote", "add", "origin", url], dest);
    }
    await syncStagingTree(process.cwd(), dest);
    git(token, ["config", "user.name", "github-actions[bot]"], dest);
    git(token, ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], dest);
    git(token, ["add", "-A", "--", ".", ":!.github/workflows"], dest);
    const stagedWorkflows = git(token, ["diff", "--cached", "--name-only", "--", ".github/workflows"], dest).trim();
    if (stagedWorkflows) throw new Error(`Refusing to push workflow changes:\n${stagedWorkflows}`);
    const dirtyWorkflows = git(token, ["status", "--porcelain", "--", ".github/workflows"], dest).trim();
    if (dirtyWorkflows) throw new Error(`Refusing to leave workflow changes:\n${dirtyWorkflows}`);
    const staged = git(token, ["diff", "--cached", "--name-only"], dest).trim();
    if (!staged) {
      console.log("staging tree is already current");
    } else {
      const sha = process.env.GITHUB_SHA || "unknown";
      git(token, ["commit", "-m", `Publish staging-${sha}`], dest);
      git(token, ["push", "origin", "HEAD:main"], dest);
      console.log(`pushed staging-${sha}`);
    }
  } catch (error) {
    console.error(redactStagingAuth(error instanceof Error ? error.message : String(error), token));
    process.exitCode = 1;
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
