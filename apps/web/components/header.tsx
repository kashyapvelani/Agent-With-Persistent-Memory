import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import Link from "next/link";

export const Header = () => {
    return (
        <header className="w-full flex items-center justify-between p-4 px-g2 bg-background z-50">
            <div className="container flex items-center justify-between">
            {/* Logo */}
            <Image src="/logo.svg" alt="Logo" width={136} height={50} />
            {/* Navigation */}
            <div>
                <Link href="/">
                  <Button variant="ghost">Home</Button>
                </Link>
                <Link href="/about">
                  <Button variant="ghost">About</Button>
                </Link>
                <Link href="/contact">
                  <Button variant="ghost">Contact</Button>
                </Link>
            </div>
            {/* User Actions */}
            <div className="flex gap-2">
                <Link href="/sign-in">
                    <Button variant="secondary">Log in</Button>
                </Link>
                <Link href="/sign-up">
                    <Button>Sign up</Button>
                </Link>
            </div>
            </div>
        </header>
    );
}
