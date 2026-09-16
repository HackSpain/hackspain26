import { redirect } from "next/navigation";

/** The feed moved to the home page; old links and `hackspain open feed` still work. */
export default function FeedPage() {
  redirect("/");
}
