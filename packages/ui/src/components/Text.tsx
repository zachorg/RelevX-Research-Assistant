/**
 * Text component
 *
 * A simple text wrapper with consistent styling across platforms.
 */

import React from "react";
import { Text as RNText, StyleSheet, TextStyle } from "react-native";

interface TextProps {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  variant?: "title" | "body" | "caption";
}

export function Text({ children, style, variant = "body" }: TextProps) {
  return (
    <RNText style={[styles.base, styles[variant], style]}>{children}</RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: "#000000",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    color: "#666666",
  },
});
