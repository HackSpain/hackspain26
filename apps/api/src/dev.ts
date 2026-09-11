import { createApp } from "./index";

createApp(undefined, (promise) => {
  promise.catch(() => console.error("Background tracking failed"));
}).listen(Number(process.env.PORT ?? 3001));
