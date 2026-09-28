import { runPackedCopy } from "./runCopy.js";

runPackedCopy()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("[packed] copy failed", err);
    process.exit(1);
  });
