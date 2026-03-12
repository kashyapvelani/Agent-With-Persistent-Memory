import Image from "next/image";

interface FeatureBoxProps {
    category: string,
    title: string,
    description: string,
    features: string[],
    imageURL: string,
    variant?: "normal" | "reverse"
}

export const FeatureBox = ({category,title,description,features,imageURL,variant}: FeatureBoxProps) => {
    return(
        <div className={`container w-full flex ${variant === "reverse" ? "flex-row-reverse" : "flex-row"} items-center h-120`}>
            <div className="flex-1 space-y-8 max-w-1/2 items-center justify-center px-8">
                <span className="text-sm tracking-widest space-x-2">{category}</span>
                <h2 className="text-3xl">{title}</h2>
                <p className="text-md text-muted-foreground">{description}</p>
                <ul className="text-md text-muted-foreground mx-4">
                    <li className="list-disc">{features[0]}</li>
                    <li className="list-disc">{features[1]}</li>
                    <li className="list-disc">{features[2]}</li>
                </ul>
            </div>
            <div className="bg-sidebar items-center justify-center max-w-1/2 rounded">
                    <Image src={imageURL} alt="Feature" width={700} height={500} className="object-cover object-center p-2 rounded-xl"/>
            </div>
        </div>
    );
}