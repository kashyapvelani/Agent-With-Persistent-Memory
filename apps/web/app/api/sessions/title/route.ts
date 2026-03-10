import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { sessionId, firstMessage } = body as {
    sessionId: string;
    firstMessage: string;
  };

  if (!sessionId || !firstMessage) {
    return new Response("Missing sessionId or firstMessage", { status: 400 });
  }

  try {
    // Generate title using gpt-4o-mini via OpenAI API
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // Fallback: truncate the first message as the title
      const fallbackTitle =
        firstMessage.length > 60
          ? firstMessage.slice(0, 57) + "..."
          : firstMessage;

      await supabase
        .from("sessions")
        .update({ title: fallbackTitle, updatedat: new Date().toISOString() })
        .eq("id", sessionId);

      return Response.json({ title: fallbackTitle });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Generate a short, concise title (max 50 characters) for a coding chat session based on the user's first message. Return ONLY the title text, no quotes or extra formatting.",
          },
          {
            role: "user",
            content: firstMessage,
          },
        ],
        max_tokens: 30,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      // Fallback to truncated message
      const fallbackTitle =
        firstMessage.length > 60
          ? firstMessage.slice(0, 57) + "..."
          : firstMessage;

      await supabase
        .from("sessions")
        .update({ title: fallbackTitle, updatedat: new Date().toISOString() })
        .eq("id", sessionId);

      return Response.json({ title: fallbackTitle });
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim() ?? firstMessage.slice(0, 60);

    // Update session title in the database
    await supabase
      .from("sessions")
      .update({ title, updatedat: new Date().toISOString() })
      .eq("id", sessionId);

    return Response.json({ title });
  } catch (err) {
    console.error("Title generation failed:", err);
    return new Response("Failed to generate title", { status: 500 });
  }
}
