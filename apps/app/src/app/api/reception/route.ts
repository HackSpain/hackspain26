export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(null, { status: 410 });
}

export async function POST() {
  return new Response(null, { status: 410 });
}
