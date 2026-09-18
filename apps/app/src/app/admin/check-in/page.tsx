import { AdminEventControls } from "@/components/admin-event-controls";
import { Page } from "@/components/page";

export default function CheckInPage() {
  return (
    <Page title="Accesos" description="Gestiona los códigos y la entrada al evento.">
      <AdminEventControls />
    </Page>
  );
}
