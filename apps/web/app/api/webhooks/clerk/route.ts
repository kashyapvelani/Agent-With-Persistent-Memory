import { headers } from "next/headers";
import { Webhook } from "svix";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { randomUUID } from "crypto";

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmailAddress[];
  username: string | null;
  external_accounts: { username?: string }[];
}

interface ClerkOrgPayload {
  id: string;
  name: string;
}

interface WebhookEvent {
  type: string;
  data: ClerkUserPayload | ClerkOrgPayload;
}

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  // Verify signature via svix
  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const user = event.data as ClerkUserPayload;
      const primaryEmail = user.email_addresses[0]?.email_address ?? null;
      const githubUsername =
        user.external_accounts.find((a) => a.username)?.username ??
        user.username ??
        null;

      await supabase.from("users").upsert(
        {
          id: randomUUID(),
          clerkid: user.id,
          email: primaryEmail,
          githubusername: githubUsername,
        },
        { onConflict: "clerkid" }
      );
      break;
    }

    case "organization.created":
    case "organization.updated": {
      const org = event.data as ClerkOrgPayload;

      await supabase.from("organizations").upsert(
        {
          id: randomUUID(),
          clerkorgid: org.id,
          name: org.name,
        },
        { onConflict: "clerkorgid" }
      );
      break;
    }

    default:
      // Ignore other event types
      break;
  }

  return new Response("OK", { status: 200 });
}
