"use client";

import { useAuth } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import Link from "next/link";

export const Header = () => {
    const { isSignedIn } = useAuth();
    return (
        <header className="w-full flex items-center justify-between p-4 px-g2 bg-background z-50 absolute">
            <div className="container flex items-center justify-between">
            {/* Logo */}
            <div className="flex flex-row items-center justify-center gap-2">
            <Image src="/logo.svg" alt="Logo" width={25} height={25} />
            <span className="text-md">Orbit</span>
            </div>
            {/* Navigation */}
            <div>
                <Link href="/">
                  <Button variant="ghost">Home</Button>
                </Link>
                <Link href="/#">
                  <Button variant="ghost">About</Button>
                </Link>
                <Link href="/#">
                  <Button variant="ghost">Contact</Button>
                </Link>
            </div>
            {/* User Actions */}
            {isSignedIn ? (
                <div>
                <Link href="/dashboard">
                    <Button>Go to Dashboard</Button>
                </Link>
            </div>):(
            <div className="flex gap-2">
                <Link href="/sign-in">
                    <Button variant="secondary">Log in</Button>
                </Link>
                <Link href="/sign-up">
                    <Button>Sign up</Button>
                </Link>
            </div>)}
            </div>
        </header>
    );
}
