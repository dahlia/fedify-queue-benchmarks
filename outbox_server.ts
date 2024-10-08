import {
  Activity,
  createFederation,
  Endpoints,
  MemoryKvStore,
  Person,
} from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import "./logging.ts";

const logger = getLogger(["bench", "outbox", "server"]);

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
  allowPrivateAddress: true,
});

federation
  .setActorDispatcher("/users/{identifier}", (ctx, identifier) => {
    return new Person({
      id: ctx.getActorUri(identifier),
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
    });
  })
  .setKeyPairsDispatcher(() => []);

const total = parseInt(Deno.env.get("TOTAL") ?? "500");
const activities = new Set();
let started: number | undefined;

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Activity, (_, activity) => {
    if (activities.size < 1) {
      started = Date.now();
      logger.info("Received first activity.");
    }
    activities.add(activity.id?.href);
    if (activities.size >= total) {
      const elapsed = Date.now() - started!;
      logger.info("All activities received; elapsed: {elapsed}s", {
        elapsed: elapsed / 1000,
      });
      const timeRecordFile = Deno.env.get("TIME_RECORD_FILE");
      if (timeRecordFile != null) {
        Deno.writeTextFileSync(timeRecordFile, elapsed.toString());
        logger.debug("Wrote time record: {file}", { file: timeRecordFile });
      }
    }
  });

function fetch(request: Request) {
  return federation.fetch(request, { contextData: undefined });
}

export default { fetch };
