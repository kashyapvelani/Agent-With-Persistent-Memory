import { Badge } from "@workspace/ui/components/badge";
import ThreeBodyMotion from "./three-body-motion";
import { Button } from "@workspace/ui/components/button";
import { Rocket } from "lucide-react";

export function HeroSection () {
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
        <Button>
            <Rocket className="size-3.5"/>
            Launch Orbit
        </Button>
      </div>
    </div>
    );
}