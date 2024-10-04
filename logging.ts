import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    { category: "bench", sinks: ["console"], level: "info" },
    { category: "fedify", sinks: ["console"], level: "warning" },
    { category: ["fedify", "federation", "actor"], sinks: [], level: "error" },
    { category: ["logtape", "meta"], sinks: ["console"], level: "warning" },
  ],
});
