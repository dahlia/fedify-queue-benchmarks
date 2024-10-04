import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    { category: "bench", sinks: ["console"], level: "debug" },
    { category: "fedify", sinks: ["console"], level: "info" },
    { category: ["fedify", "federation", "actor"], sinks: [], level: "error" },
    { category: ["logtape", "meta"], sinks: ["console"], level: "warning" },
  ],
});
