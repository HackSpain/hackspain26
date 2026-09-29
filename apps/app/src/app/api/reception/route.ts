export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, { status: 410 });
}

export function POST() {
  return new Response(null, { status: 410 });
}
