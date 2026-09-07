/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as devOtp from "../devOtp.js";
import type * as feed from "../feed.js";
import type * as github from "../github.js";
import type * as githubFeed from "../githubFeed.js";
import type * as http from "../http.js";
import type * as lib_attendance from "../lib/attendance.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_dietary from "../lib/dietary.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_eventDetails from "../lib/eventDetails.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_team from "../lib/team.js";
import type * as lib_urls from "../lib/urls.js";
import type * as lib_validators from "../lib/validators.js";
import type * as migrations from "../migrations.js";
import type * as milestones from "../milestones.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as perks from "../perks.js";
import type * as submissions from "../submissions.js";
import type * as teams from "../teams.js";
import type * as tracks from "../tracks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  admin: typeof admin;
  auth: typeof auth;
  crons: typeof crons;
  devOtp: typeof devOtp;
  feed: typeof feed;
  github: typeof github;
  githubFeed: typeof githubFeed;
  http: typeof http;
  "lib/attendance": typeof lib_attendance;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/dietary": typeof lib_dietary;
  "lib/errors": typeof lib_errors;
  "lib/eventDetails": typeof lib_eventDetails;
  "lib/normalize": typeof lib_normalize;
  "lib/team": typeof lib_team;
  "lib/urls": typeof lib_urls;
  "lib/validators": typeof lib_validators;
  migrations: typeof migrations;
  milestones: typeof milestones;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  perks: typeof perks;
  submissions: typeof submissions;
  teams: typeof teams;
  tracks: typeof tracks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
