"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Sparkles } from "lucide-react";

export function Navbar() {
  const { user, loading } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-wide flex h-16 items-center justify-between">
        {/* Logo / Brand */}
        <Link
          href={user ? "/projects" : "/"}
          className="flex items-center gap-2 group"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text group-hover:opacity-80 transition-opacity">
            RelevX
          </span>
        </Link>

        {/* Navigation Links & Auth */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="w-20 h-10 animate-pulse bg-muted rounded-md" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {user.displayName || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.displayName && (
                      <p className="font-medium text-sm">{user.displayName}</p>
                    )}
                    {user.email && (
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleSignIn} variant="default">
              Sign In with Google
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
