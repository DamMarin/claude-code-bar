import { basename } from "node:path";
import { COLORS } from "../shared/colors.mjs";
import { getContextUsageStyle, renderBar } from "./progress-bar.mjs";
import { formatDuration } from "../shared/format-duration.mjs";
import { formatReset } from "../shared/format-reset.mjs";

export function modelSegment(displayName) {
  return `🤖 ${displayName}`;
}

export function contextSegment(usedPercentage) {
  const { clamped, color } = getContextUsageStyle(usedPercentage);
  return `🧠 ${color}${Math.round(clamped)}%${COLORS.reset}`;
}

export function directorySegment(currentDir) {
  return basename(currentDir);
}

export function gitSegment(gitInfo) {
  if (!gitInfo) return null;
  const name = `${gitInfo.branch}${gitInfo.dirty ? "*" : ""}`;
  return `${name}`;
}

export function durationSegment(durationMs) {
  return `⏱️ ${formatDuration(durationMs)}`;
}
export function rateLimitSegment(label, percentage, resetsAt) {
  return `${label}  ${renderBar(percentage)}  resets ${formatReset(resetsAt)}`;
}

export function updateSegment(latest) {
  return `${COLORS.yellow}↑ ${latest}${COLORS.reset}`;
}
