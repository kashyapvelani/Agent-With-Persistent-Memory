import * as Sentry from "@sentry/nextjs";
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export async function GET() {
  Sentry.logger.info("Sentry example API called");

  throw new SentryExampleAPIError(
    "This is a test error from the Sentry example API route.",
  );
}
