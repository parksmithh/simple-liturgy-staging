#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

function normalize(path) {
  return path.split(sep).join("/");
}

function isWorkflow(rel) {
  return rel === ".github/workflows" || rel.startsWith(".github/workflows/");
}

function skipSource(rel) {
  return rel === ".git" || rel.startsWith(".git/") || rel === "CNAME" || isWorkflow(rel);
}

async function listFiles(root, skip) {
  const files = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      const rel = normalize(relative(root, path));
      if (skip(rel)) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(rel);
      else throw new Error(`unsupported file at ${rel}`);
    }
  }
  await visit(root);
  return files;
}

async function workflowFingerprint(root) {
  const dir = join(root, ".github", "workflows");
  const lines = [];
  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        const body = await readFile(path);
        const rel = normalize(relative(dir, path));
        lines.push(`${rel} ${createHash("sha256").update(body).digest("hex")}`);
      }
    }
  }
  await visit(dir);
  lines.sort();
  return lines.join("\n");
}

export async function syncStagingTree(source, dest) {
  const before = await workflowFingerprint(dest);
  const sourceFiles = await listFiles(source, skipSource);
  const sourceSet = new Set(sourceFiles);
  for (const rel of sourceFiles) {
    const target = join(dest, rel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(join(source, rel)));
  }
  const destFiles = await listFiles(dest, rel => rel === ".git" || rel.startsWith(".git/") || isWorkflow(rel));
  for (const rel of destFiles) {
    if (rel === "CNAME" || !sourceSet.has(rel)) await rm(join(dest, rel), { force: true });
  }
  await rm(join(dest, "CNAME"), { force: true });
  const after = await workflowFingerprint(dest);
  if (before !== after) throw new Error("sync changed .github/workflows on the staging tree");
}
