"use client";

import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@clerk/nextjs";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import ThreeBodyMotion from "./three-body-motion";
import Link from "next/link";

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

    const handleLaunchOrbit = async () => {
        const targetPath = "/dashboard";
        try {
          if (!isSignedIn) {
            throw new HeroRedirectError("/sign-in");
          }
          window.location.href = targetPath;
        } catch (error) {
          if (error instanceof HeroRedirectError) {
            Sentry.captureException(error);
            setHasSentError(true);
            window.location.href = error.message.match(/"(.*?)"/)?.[1] || "/sign-in";
          } else {
            Sentry.captureException(error);
            setHasSentError(true);
          }
        }
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
          <Badge variant="secondary">INTRODUCING ORBIT</Badge>
          <h1 className="text-6xl tracking-tight">
            Every Codebase is a Planet.
          </h1>
          <h1 className="text-6xl text-muted-foreground">
            Orbit lets agents explore it.
          </h1>
        </div>
      </section>
      <div className="absolute flex flex-col bottom-4 w-full items-center gap-4">
        <div className="text-sm text-center text-foreground w-2/6">
            The Space Station for Autonomous Development. Persistent AI agents working on your codebase 24/7.
        </div>
        <Link href="/dashboard">
        <Button>
            <Rocket className="size-3.5"/>
            Launch Orbit
        </Button>
        </Link>
         <div className="flex-spacer" />
      </div>
    </div>
    );
}
