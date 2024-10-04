import $, { KillSignal, KillSignalController } from "@david/dax";
import { getLogger } from "@logtape/logtape";
import { delay } from "@std/async";
import { exists } from "@std/fs/exists";
import { markdownTable } from "markdown-table";
import "./logging.ts";

async function spawnServer(timeRecordFile: string, signal: KillSignal) {
  return await $`deno serve --allow-all --port=3000 outbox_server.ts`
    .signal(signal)
    .cwd(import.meta.dirname!)
    .env("TIME_RECORD_FILE", timeRecordFile);
}

async function spawnWorker(
  kv: string,
  env: Record<string, string>,
  signal: KillSignal,
) {
  return await $`deno serve --allow-all --port=8000 outbox.ts`
    .signal(signal)
    .cwd(import.meta.dirname!)
    .env("KV", kv)
    .env("WORKER", "1")
    .env(env);
}

async function runClient(
  kv: string,
  timeRecordFile: string,
  env: Record<string, string>,
) {
  return await $`deno run --allow-all outbox_client.ts`
    .cwd(import.meta.dirname!)
    .env("KV", kv)
    .env("WORKER", "0")
    .env("TIME_RECORD_FILE", timeRecordFile)
    .env(env);
}

interface BenchResult {
  clientElapsed: number;
  serverElapsed: number;
}

async function run(env: Record<string, string> = {}): Promise<BenchResult> {
  const logger = getLogger(["bench", "run"]);
  await $`deno cache *.ts`;
  const clientTimeRecordFile = await Deno.makeTempFile({
    prefix: "fedify-bench-record-",
  });
  await Deno.remove(clientTimeRecordFile);
  const serverTimeRecordFile = await Deno.makeTempFile({
    prefix: "fedify-bench-record-",
  });
  await Deno.remove(serverTimeRecordFile);
  let kv = Deno.env.get("KV");
  if (kv == null) {
    kv = await Deno.makeTempFile({
      prefix: "fedify-bench-kv-",
    });
    await Deno.remove(kv);
  }
  const controller = new KillSignalController();
  const jobs = Promise.all([
    spawnServer(serverTimeRecordFile, controller.signal),
    spawnWorker(kv, env, controller.signal),
    delay(1000).then(() => runClient(kv, clientTimeRecordFile, env)),
  ]);
  Deno.addSignalListener("SIGINT", controller.kill.bind(controller));
  while (true) {
    if (
      await exists(serverTimeRecordFile) && await exists(clientTimeRecordFile)
    ) {
      logger.debug("The time record files found.");
      break;
    }
    await delay(1000);
  }
  controller.kill("SIGINT");
  try {
    await jobs;
  } catch {
    // Ignore
  }
  const clientElapsed =
    parseInt(await Deno.readTextFile(clientTimeRecordFile)) /
    1000;
  const serverElapsed =
    parseInt(await Deno.readTextFile(serverTimeRecordFile)) /
    1000;
  return { clientElapsed, serverElapsed };
}

const logger = getLogger("bench");

logger.info("No queue:");
const noQueue = await run({ NO_QUEUE: "1" });
logger.info("InProcessMessageQueue:");
const inProcess = await run({ IN_PROCESS: "1" });
logger.info("DenoKvMessageQueue:");
const denoKv = await run();
logger.info("RedisMessageQueue:");
const redis = await run({ REDIS_URL: "redis://localhost:6379" });
logger.info("PostgresMessageQueue:");
const pg = await run({ PG_URL: "postgresql://localhost:5432/fedify_bench" });
logger.info("InProcessMessageQueue × 4:");
const inProcessP = await run({ IN_PROCESS: "1", PARALLEL: "4" });
logger.info("DenoKvMessageQueue × 4:");
const denoKvP = await run({ PARALLEL: "4" });
logger.info("RedisMessageQueue × 4:");
const redisP = await run({
  REDIS_URL: "redis://localhost:6379",
  PARALLEL: "4",
});
logger.info("PostgresMessageQueue × 4:");
const pgP = await run({
  PG_URL: "postgresql://localhost:5432/fedify_bench",
  PARALLEL: "4",
});

logger.info("Bench result: {result}", {
  result: {
    noQueue,
    inProcess,
    denoKv,
    redis,
    pg,
    inProcessP,
    denoKvP,
    redisP,
    pgP,
  },
});

const table = markdownTable([
  ["Driver", "Time taken to send[^1]", "Time taken to receive[^2]"],
  [
    "No queue",
    noQueue.clientElapsed.toString(),
    noQueue.serverElapsed.toString(),
  ],
  [
    "`InProcessMessageQueue`",
    inProcess.clientElapsed.toString(),
    inProcess.serverElapsed.toString(),
  ],
  [
    "`DenoKvMessageQueue`",
    denoKv.clientElapsed.toString(),
    denoKv.serverElapsed.toString(),
  ],
  [
    "`RedisMessageQueue`",
    redis.clientElapsed.toString(),
    redis.serverElapsed.toString(),
  ],
  [
    "`PostgresMessageQueue`",
    pg.clientElapsed.toString(),
    pg.serverElapsed.toString(),
  ],
  [
    "`InProcessMessageQueue` × 4[^3]",
    inProcessP.clientElapsed.toString(),
    inProcessP.serverElapsed.toString(),
  ],
  [
    "`DenoKvMessageQueue` × 4[^3]",
    denoKvP.clientElapsed.toString(),
    denoKvP.serverElapsed.toString(),
  ],
  [
    "`RedisMessageQueue` × 4[^3]",
    redisP.clientElapsed.toString(),
    redisP.serverElapsed.toString(),
  ],
  [
    "`PostgresMessageQueue` × 4[^3]",
    pgP.clientElapsed.toString(),
    pgP.serverElapsed.toString(),
  ],
]);
console.log(table);
