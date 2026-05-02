import { createApp } from "./app.js";

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Maunds Refinery v2 running on :${PORT}`);
  console.log(`  API:        http://localhost:${PORT}/v1/refine`);
  console.log(`  Playground: http://localhost:${PORT}/playground`);
});
