"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePlans } from "@/hooks/use-plans";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, LogOut, Sparkles, CreditCard, Receipt, Loader2 } from "lucide-react";
import { relevx_api } from "@/lib/client";
import { BillingPortalLinkResponse } from "core/models/billing";

export function Navbar() {
  const { user, userProfile, loading } = useAuth();
  const { plans } = usePlans();
  const router = useRouter();

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

  const getPlanStatus = () => {
    if (!userProfile) return "";
    if (!userProfile?.planId) return "Inactive";
    const userPlan = plans.find((p) => p.id === userProfile.planId);
    if (!userPlan) return "Inactive";
    return userPlan.infoPrice === 0 ? "Free" : "Pro";
  };

  const [isBillingLoading, setIsBillingLoading] = React.useState(false);

  const handleUserBillingClicked = async () => {
    setIsBillingLoading(true);
    try {
      // fetch a customer specific payment link..
      const response = await relevx_api.get<BillingPortalLinkResponse>(
        `/api/v1/user/billing/portal`
      );
      if (!response.ok) {
        throw new Error("Failed to create or update user");
      }

      window.location.href = response.stripeBillingPortalLink;
    } catch (error) {
      console.error("Failed to redirect to billing portal:", error);
      setIsBillingLoading(false);
    }
  };

  const planStatus = getPlanStatus();
  const statusColor =
    planStatus === "Pro"
      ? "bg-gradient-to-r from-blue-500 to-purple-600 border-none text-white"
      : planStatus === "Free"
        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
        : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-wide flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text group-hover:opacity-80 transition-opacity">
                RelevX
              </span>
            </Link>

            {planStatus === "Inactive" && (
              <Button
                variant="ghost"
                asChild
                className="hidden sm:flex h-auto py-1.5 text-base font-medium transition-all duration-300 hover:scale-105 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-600/10 hover:text-blue-600"
              >
                <Link href="/pricing">Pricing</Link>
              </Button>
            )}

            <Button
              variant="ghost"
              asChild
              className="hidden sm:flex h-auto py-1.5 text-base font-medium transition-all duration-300 hover:scale-105 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-600/10 hover:text-blue-600"
            >
              <Link href="/projects">Projects</Link>
            </Button>
          </div>

          {/* Navigation Links & Auth */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-20 h-10 animate-pulse bg-muted rounded-md" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 relative">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full border border-border"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <span className="hidden sm:inline font-medium">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-2">
                  <div className="flex items-center justify-start gap-3 p-2 mb-1">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-10 h-10 rounded-full border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex flex-col space-y-0.5 overflow-hidden">
                      {user.displayName && (
                        <p className="font-semibold text-sm truncate">{user.displayName}</p>
                      )}
                      {user.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-2 pb-2">
                    <div className={`text-xs px-2 py-1 rounded-full w-fit font-medium flex items-center gap-1.5 ${statusColor}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${planStatus === 'Pro' ? 'bg-white' : 'bg-current'}`} />
                      {planStatus} Plan
                    </div>
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/pricing")}
                    className="gap-2 cursor-pointer focus:text-blue-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pricing
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={handleUserBillingClicked}
                    className="gap-2 cursor-pointer focus:text-blue-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                  >
                    <Receipt className="w-4 h-4" />
                    Billing
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleSignIn}
                variant="default"
                className="shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40"
              >
                Sign In with Google
              </Button>
            )}
          </div>
        </div>
      </nav>
      <Dialog open={isBillingLoading} onOpenChange={setIsBillingLoading}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <DialogHeader className="items-center space-y-2">
            <DialogTitle className="text-center">Redirecting to Billing</DialogTitle>
            <DialogDescription className="text-center">
              Preparing secure billing portal...
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
