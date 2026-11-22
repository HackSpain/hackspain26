"use client";

import { Suspense } from "react";
import { ParticipantsBody } from "@/components/participant-directory/people-page";
import { LoadingText } from "@/components/page";
import { contentWidth } from "@/lib/layout";

const container = contentWidth("/people");

export default function ParticipantsPage() {
  return (
    <Suspense
      fallback={
        <div className={container}>
          <LoadingText />
        </div>
      }
    >
      <ParticipantsBody />
    </Suspense>
  );
}
