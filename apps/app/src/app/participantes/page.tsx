import { ParticipantDirectory } from "@/components/participant-directory/participant-directory";
import { demoParticipants } from "./demo-participants";

export default function ParticipantsPage() {
  return <ParticipantDirectory participants={demoParticipants} />;
}
