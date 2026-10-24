import { getPkg, getUpdateInfo, scheduleUpdateCheck } from "../io/update-check.mjs";

export function version() {
  const pkg = getPkg();
  console.log(pkg.version);

  const info = getUpdateInfo();
  if (info) {
    console.log(
      `\n  Update available: ${info.current} → ${info.latest}\n` +
        `  Run \`npm install -g ${pkg.name}\` to update.\n`
    );
  }
  // Also trigger a background check for freshness
  scheduleUpdateCheck();
}
