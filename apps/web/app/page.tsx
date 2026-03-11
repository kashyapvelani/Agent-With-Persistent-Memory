
import { Footer } from "@/features/home/components/footer";
import { Header } from "@/features/home/components/header";
import { HeroSection } from "@/features/home/components/hero-section";
import { Separator } from "@workspace/ui/components/separator";
import { FeatureSection } from "@/features/home/components/feature-section"

export default function Page() {
  return (
    <>
      <Header/>
      <HeroSection />
      <Separator className="my-12" />
      {/* Features */}
      <FeatureSection />
      <Footer />
    </>
  );
}
