import { basename } from "node:path";
import { renderBar } from "./progress-bar.mjs";
import { formatDuration } from "../shared/format-duration.mjs";
import { formatReset } from "../shared/format-reset.mjs";

export function modelSegment(displayName, compact) {
  return compact ? displayName : `🤖 ${displayName}`;
}

export function contextSegment(usedPercentage, compact) {
  return compact ? renderBar(usedPercentage) : `🧠 ${renderBar(usedPercentage)}`;
}

export function directorySegment(currentDir, compact) {
  return compact ? basename(currentDir) : `📁 ${basename(currentDir)}`;
}

export function gitSegment(gitInfo, compact) {
  if (!gitInfo) return null;
  const name = `${gitInfo.branch}${gitInfo.dirty ? "*" : ""}`;
  return compact ? name : `🌿 ${name}`;
}

export function durationSegment(durationMs, compact) {
  return compact ? formatDuration(durationMs) : `⏱️ ${formatDuration(durationMs)}`;
}

export function effortSegment(effortLevel, compact) {
  return compact ? effortLevel : `⚡ ${effortLevel}`;
}

export function rateLimitSegment(label, percentage, resetsAt) {
  return `${label}  ${renderBar(percentage)}  resets ${formatReset(resetsAt)}`;
}
