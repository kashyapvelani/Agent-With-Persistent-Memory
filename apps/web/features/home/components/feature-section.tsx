import { FeatureBox } from "./feature-box";
import { Separator } from "@workspace/ui/components/separator"

const features = [{
    category: "MISSION MEMORY",
    title: "Orbit remembers your entire codebase.",
    description: "Traditional AI coding tools forget context between sessions. Orbit maintains persistent project memory, so your AI agent understands the system like a long-term collaborator. Orbit continuously builds a structured knowledge graph of your repository:",
    features: ["Architecture overview", "File relationships", "Module responsibilities"],
    imageURL: "/Agent Dashboard.png",
    variant: "normal"
},{
    category: "PLANETARY MAPPING",
    title: "Full-Codebase Navigation.",
    description: `Orbit maps your entire repository before it starts working.
Instead of loading only a few files into context, Orbit builds a structured map of the entire codebase.
This allows the agent to understand:`,
    features: ["Relationships between files", "Dependency graphs", "Architecture boundaries"],
    imageURL: "/Agent Workspace.png",
    variant: "reverse"
}]

export const FeatureSection = () => {
    return (
        <div className="flex flex-col gap-12">
            {features.map((feature, index) => (
                <div key={index}>
                <FeatureBox 
                    category={feature.category}
                    title={feature.title}
                    description={feature.description}
                    features={feature.features}
                    imageURL={feature.imageURL}
                    variant={feature.variant as "normal" | "reverse"}
                />
                <Separator />
                </div>
            ))}
        </div>
    );
}