import { Create, Note, Recipient } from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import { federation } from "./outbox.ts";

const logger = getLogger(["bench", "outbox", "client"]);

const ctx = federation.createContext(
  new URL("http://localhost:8000/"),
  undefined,
);

const activity = new Create({
  actor: new URL("http://localhost:8000/users/bench"),
  to: new URL("http://localhost:3000/users/bench"),
  object: new Note({
    attribution: new URL("http://localhost:8000/users/bench"),
    to: new URL("http://localhost:3000/users/bench"),
    content: "Hello, world!",
  }),
});

const recipients: Recipient[] = [];
for (let i = 0; i < 10; i++) {
  recipients.push({
    id: new URL(`http://localhost:3000/users/${i}`),
    inboxId: new URL(`http://localhost:3000/users/${i}/inbox`),
  });
}

const total = parseInt(Deno.env.get("TOTAL") ?? "5000");
const started = Date.now();
for (let i = 0; i < total; i++) {
  await ctx.sendActivity(
    { identifier: "bench" },
    recipients,
    activity.clone({
      id: new URL(`http://localhost:8000/activities/${i + 1}`),
    }),
  );
  logger.info("Activity {index}/{total}", { index: i + 1, total });
}

const elapsed = Date.now() - started;
if (Deno.env.get("TIME_RECORD_FILE") != null) {
  Deno.writeTextFileSync(Deno.env.get("TIME_RECORD_FILE")!, elapsed.toString());
  logger.debug("Wrote time record: {file}", {
    file: Deno.env.get("TIME_RECORD_FILE"),
  });
}
