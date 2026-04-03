"use client";

import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@clerk/nextjs";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import ThreeBodyMotion from "./three-body-motion";

class HeroRedirectError extends Error {
  constructor(targetPath: string) {
    super(`Launch ADE redirect failed before navigation to "${targetPath}".`);
    this.name = "HeroRedirectError";
  }
}

export function HeroSection () {
    const { isSignedIn } = useAuth();
    const [hasSentError, setHasSentError] = useState(false);
    const [isConnected, setIsConnected] = useState(true);

    const handleLaunchAde = async () => {
        Sentry.logger.info("User clicked the button, throwing a sample error");
        const targetPath = "/dashboard";
        await Sentry.startSpan(
          {
            name: "HeroSection Launch ADE Click",
            op: "user-interaction",
          },
          async () => {
            if (!isSignedIn) {
              Sentry.logger.warn("User is not signed in, throwing error to prevent redirect");
              throw new HeroRedirectError(targetPath);
            }
            window.location.href = targetPath;
            setHasSentError(true);
          },
        );
    };

    useEffect(() => {
        Sentry.logger.info("Home Page loaded");
        async function checkConnectivity() {
          const result = await Sentry.diagnoseSdkConnectivity();
          setIsConnected(result !== "sentry-unreachable");
        }
        checkConnectivity();
      }, []);

    return (
        <div className="relative container min-h-screen overflow-hidden bg-background text-foreground">
            <ThreeBodyMotion className="absolute inset-0 pointer-events-none" />
      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-(--g2) space-y-4">
          <Badge variant="secondary">INTRODUCING ADE</Badge>
          <h1 className="text-6xl tracking-tight">
            Every Codebase is a Planet.
          </h1>
          <h1 className="text-6xl text-muted-foreground">
            ADE lets agents explore it.
          </h1>
        </div>
      </section>
      <div className="absolute flex flex-col bottom-4 w-full items-center gap-4">
        <div className="text-sm text-center text-foreground w-2/6">
            The Space Station for Autonomous Development. Persistent AI agents working on your codebase 24/7.
        </div>
        <Button onClick={handleLaunchAde} className="hover:scale-105">
            <Rocket className="size-3.5"/>
            Launch ADE
        </Button>
        {hasSentError ? (
          <p className="success">Error sent to Sentry.</p>
        ) : !isConnected ? (
          <div className="connectivity-error">
            <p>
              It looks like network requests to Sentry are being blocked, which
              will prevent errors from being captured. Try disabling your
              ad-blocker to complete the test.
            </p>
          </div>
        ) : (
          <div className="success_placeholder" />
        )}
         <div className="flex-spacer" />
      </div>
    </div>
    );
}
