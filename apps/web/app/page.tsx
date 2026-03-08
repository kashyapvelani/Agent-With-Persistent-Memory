import { Header } from "@/components/header"
import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <>
      <Header />
      <main className="flex flex-col container py-v4 justify-center gap-4">
        <h1 className="text-2xl">NexGenesis: AI Agent with Persistent Memory</h1>
        <div className="flex gap-2">
          <Button>Get Started</Button>
        </div>
      </main>
    </>
  )
}
