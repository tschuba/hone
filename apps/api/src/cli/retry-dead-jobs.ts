import { closeDatabase, prisma } from "../db/client";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const deadJobs = await prisma.aiJob.findMany({
    where: {
      status: "DEAD",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      id: true,
      lastError: true,
      userId: true,
    },
  });

  if (dryRun) {
    for (const job of deadJobs) {
      console.log(
        [job.id, job.userId, job.createdAt.toISOString(), job.lastError ?? ""].join("\t"),
      );
    }

    return;
  }

  if (deadJobs.length === 0) {
    console.log("No dead jobs found");
    return;
  }

  await prisma.aiJob.updateMany({
    where: {
      id: {
        in: deadJobs.map((job) => job.id),
      },
    },
    data: {
      heartbeatAt: null,
      lockedUntil: null,
      status: "PENDING",
      workerId: null,
    },
  });

  console.log(`Requeued ${deadJobs.length} dead jobs`);
}

main()
  .catch((error) => {
    console.error("Retry dead jobs failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });