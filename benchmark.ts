import $, { KillSignal, KillSignalController } from "@david/dax";
import { getLogger } from "@logtape/logtape";
import { delay } from "@std/async";
import { exists } from "@std/fs/exists";
import Redis from "ioredis";
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

const benchmarks: Record<string, Record<string, string>> = {
  "No queue": { NO_QUEUE: "1" },
  InProcessMessageQueue: { IN_PROCESS: "1" },
  DenoKvMessageQueue: {},
  RedisMessageQueue: { REDIS_URL: "redis://localhost:6379" },
  PostgresMessageQueue: { PG_URL: "postgresql://localhost:5432/fedify_bench" },
  "InProcessMessageQueue × 4[^3]": { IN_PROCESS: "1", PARALLEL: "4" },
  "DenoKvMessageQueue × 4[^3]": { PARALLEL: "4" },
  "RedisMessageQueue × 4[^3]": {
    REDIS_URL: "redis://localhost:6379",
    PARALLEL: "4",
  },
  "PostgresMessageQueue × 4[^3]": {
    PG_URL: "postgresql://localhost:5432/fedify_bench",
    PARALLEL: "4",
  },
};

const logger = getLogger("bench");
let cachedResults: Record<string, BenchResult> = {};
try {
  cachedResults = JSON.parse(await Deno.readTextFile(".bench-cache.json"));
} catch {
  // Ignore
}
for (const [name, env] of Object.entries(benchmarks)) {
  logger.info("Running benchmark: {name}", { name });
  if (cachedResults[name] != null) {
    logger.info("The result is cached; skipping...");
    continue;
  }
  cachedResults[name] = await run(env);
  await Deno.writeTextFile(".bench-cache.json", JSON.stringify(cachedResults));
}

const table = markdownTable([
  ["Driver", "Time taken to send[^1]", "Time taken to receive[^2]"],
  ...Object.entries(cachedResults).map((
    [name, { clientElapsed, serverElapsed }],
  ) => [
    name,
    `${clientElapsed.toFixed(2)}s`,
    `${serverElapsed.toFixed(2)}s`,
  ]),
], { align: ["", "r", "r"] });
console.log(table);
