/**
 * Screen component
 *
 * A simple layout wrapper with safe area handling and padding.
 * Works on both web and mobile.
 */

import React from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: any;
}

export function Screen({ children, scrollable = false, style }: ScreenProps) {
  const Container = scrollable ? ScrollView : View;

  return (
    <Container
      style={[styles.container, style]}
      contentContainerStyle={scrollable ? styles.scrollContent : undefined}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#ffffff",
    // Add safe area for mobile
    paddingTop: Platform.OS === "web" ? 20 : 50,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.OS === "web" ? 20 : 50,
  },
});
