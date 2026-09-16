import { buildNetwork, initialPoints } from "./network-model";
import type { DirectoryParticipant } from "./types";

// Both expensive steps run off the UI thread. The owner terminates this worker
// after receiving the result, on input changes, and when the view unmounts.
self.addEventListener(
  "message",
  (event: MessageEvent<DirectoryParticipant[]>) => {
    const network = buildNetwork(event.data);
    self.postMessage(
      { network, points: initialPoints(network) },
      { transfer: [] },
    );
  },
);
