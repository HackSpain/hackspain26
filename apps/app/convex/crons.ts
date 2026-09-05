import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Public GitHub activity of every team repo, into the feed. Conditional
// requests keep this cheap; see convex/githubFeed.ts for rate limits.
crons.interval(
  "poll team repos for the feed",
  { minutes: 3 },
  internal.githubFeed.pollRepos,
  {},
);

export default crons;
