import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DeliveryBriefing() {
  return (
    <Card className="border-hs-red">
      <CardHeader>
        <p className="font-bungee text-xs uppercase tracking-wide text-hs-red">
          Aviso
        </p>
        <CardTitle className="text-xl sm:text-2xl">
          Sobre entregas y presentaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
        <section className="space-y-2">
          <h3 className="font-bungee text-sm">Gran Premio</h3>
          <p className="font-medium text-hs-ink">
            Para la entrega de las 11, preparad esto para los jueces de San
            Francisco:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-hs-brown">
            <li>
              Un vídeo de 3 minutos. Contad el proyecto a fondo, para que
              puedan juzgar creatividad, problem solving y craftsmanship.
            </li>
            <li>Si aplica, una demo que se pueda probar.</li>
            <li>El repo.</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="font-bungee text-sm">Premios de cada track</h3>
          <p className="font-medium text-hs-ink">
            Hay unas 2 horas para esta parte.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-hs-brown">
            <li>
              Tendréis unos 10 minutos para presentar el proyecto a los
              jueces de cada track. Ese tiempo incluye sus preguntas.
            </li>
            <li>El tiempo lo gestionan los propios track masters.</li>
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
