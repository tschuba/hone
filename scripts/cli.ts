const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: bun run cli <command> [...args]");
  process.exit(1);
}

if (command === "seed-exercises") {
  const child = Bun.spawn(["bun", "run", "--cwd", "apps/api", "cli", ...args], {
    cwd: process.cwd(),
    stderr: "inherit",
    stdout: "inherit",
  });

  const exitCode = await child.exited;
  process.exit(exitCode);
}

if (command === "retry-dead-jobs") {
  const child = Bun.spawn(
    ["bun", "run", "apps/api/src/cli/retry-dead-jobs.ts", ...args],
    {
      cwd: process.cwd(),
      stderr: "inherit",
      stdout: "inherit",
    },
  );

  const exitCode = await child.exited;
  process.exit(exitCode);
}

console.error(`Unknown CLI command: ${command}`);
process.exit(1);
