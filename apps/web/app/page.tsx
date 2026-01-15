"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Sparkles,
  Clock,
  Mail,
  Search,
  Brain,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  const { loading, userProfile } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Research",
      description:
        "Advanced AI analyzes and curates the most relevant information for your topics",
    },
    {
      icon: Clock,
      title: "Set and Forget",
      description:
        "Schedule recurring research updates - daily, weekly, or monthly",
    },
    {
      icon: Search,
      title: "Smart Search",
      description:
        "Automatically searches across multiple sources to find the best content",
    },
    {
      icon: Mail,
      title: "Delivered to You",
      description: "Get curated insights delivered straight to your inbox",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description:
        "Instant results powered by cutting-edge search and AI technology",
    },
    {
      icon: Sparkles,
      title: "Always Fresh",
      description: "Stay up-to-date with the latest information in your field",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Hero Section */}
      <section className="container-wide py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-muted/30 mb-8"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">
              AI-Powered Research Assistant
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            Stay Informed, <span className="gradient-text">Effortlessly</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto"
          >
            Set up recurring research projects and get AI-curated insights
            delivered straight to your inbox. Never miss important updates in
            your field again.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {!userProfile && (
              <Button
                onClick={handleSignIn}
                size="lg"
                className="gap-2 text-lg px-8 hover:scale-105 transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-lg px-8 hover:scale-105 transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
            >
              Learn More
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="container-wide py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful Features for Modern Researchers
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to stay on top of your research topics without
            the manual work.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow glass-dark">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl mb-2">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container-wide py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes with our simple three-step process
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              step: "01",
              title: "Create a Project",
              description:
                "Define what you want to research and how often you want updates",
            },
            {
              step: "02",
              title: "AI Does the Work",
              description:
                "Our AI searches, analyzes, and curates the most relevant information",
            },
            {
              step: "03",
              title: "Receive Insights",
              description:
                "Get beautifully formatted research reports delivered to your inbox",
            },
          ].map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-5xl font-bold gradient-text mb-4">
                {step.step}
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container-wide py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Card className="glass text-center p-12">
            <CardHeader>
              <CardTitle className="text-3xl md:text-4xl mb-4">
                Ready to Transform Your Research?
              </CardTitle>
              <CardDescription className="text-lg mb-8 max-w-2xl mx-auto">
                Join researchers and professionals who save hours every week
                with automated research.
              </CardDescription>
              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    if (!userProfile) {
                      handleSignIn();
                    } else {
                      router.push("/projects");
                    }
                  }}
                  size="lg"
                  className="gap-2 text-lg px-8 hover:scale-105 transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
                >
                  Start Researching Now
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-20">
        <div className="container-wide text-center text-sm text-muted-foreground">
          <p>&copy; 2025 RelevX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
