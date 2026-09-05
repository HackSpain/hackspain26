import { CliError } from "../../lib/errors";
import { VERSION } from "../../version";
import type { Sink } from "./spool";

/**
 * Generic NDJSON POST. Off unless a URL is configured. Shaped so a ClickHouse
 * HTTP endpoint (behind an auth proxy doing `INSERT … FORMAT JSONEachRow`) or
 * any other NDJSON receiver works without client changes.
 */
export function httpSink(
  url: string,
  token: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch
): Sink {
  return {
    name: "http",
    write: async (events) => {
      if (events.length === 0) {
        return;
      }
      const bearer = await token();
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-ndjson",
          "user-agent": `hackspain-cli/${VERSION}`,
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
        body: `${events.map((e) => JSON.stringify(e)).join("\n")}\n`,
      });
      if (!response.ok) {
        throw new CliError(
          `Telemetry endpoint answered ${response.status} ${response.statusText}`,
          { code: "SINK_HTTP" }
        );
      }
    },
  };
}
