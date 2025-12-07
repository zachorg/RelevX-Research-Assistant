"use client";

import React from "react";
import { usePlans } from "@/hooks/use-plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function PricingPage() {
  const { plans, loading, error } = usePlans();
  const { userProfile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-10">
        <p>Error: {error}</p>
      </div>
    );
  }

  const handleSelectPlan = (planId: string) => {
    // @TODO: Implement stripe checkout
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Pricing Plans</h1>
        <p className="text-muted-foreground">
          Choose the plan that best fits your research needs.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl capitalize">{plan.infoName}</CardTitle>
              <CardDescription>
                {plan.infoDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div className="flex items-baseline justify-start pb-4">
                  <span className="text-xl font-medium text-muted-foreground mr-1 self-start">US</span>
                  <span className="text-5xl font-bold">
                     ${plan.infoPrice ?? "0"}
                  </span>
                  {/* <span className="text-muted-foreground ml-1">/month</span> */}
                </div>
                
                {userProfile && userProfile.planId == plan.id ? (
                  <Button className="rounded-lg px-6 bg-gradient-to-r from-white-500 to-green-700 text-white">
                    Selected
                  </Button>
                ) : (
                  <Button className="rounded-lg px-6 bg-gradient-to-r from-white-500 to-red-600 text-white shadow-md hover:shadow-lg hover:from-white-500 hover:to-green-700 hover:scale-105 transition-all duration-300" onClick={() => handleSelectPlan(plan.id)}>
                    Select Plan
                  </Button>
                )}
              </div>

              <div className="mt-6">
                <p className="font-semibold text-sm mb-3">{plan.infoPerksHeader}</p>
                <ul className="space-y-3 text-sm">
                  {plan.infoPerks?.map((perk, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {plans.length === 0 && !loading && (
        <div className="text-center py-10 text-muted-foreground">
          No plans available at the moment.
        </div>
      )}
    </div>
  );
}
