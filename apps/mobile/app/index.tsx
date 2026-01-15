/**
 * Main screen for mobile app
 *
 * Shows authentication state and project management UI.
 * Uses the same logic as the web app but for native mobile.
 */

import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Screen, Text, Button, Input, Picker } from "ui";
import { useAuth, useProjects, signInWithGoogle, signOut } from "core";
import type { Frequency } from "core";

export default function IndexScreen() {
  const { user, loading: authLoading } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    createProject,
  } = useProjects(user?.uid);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [isCreating, setIsCreating] = useState(false);

  const handleSignIn = async () => {
    try {
      // TODO: Implement native Google Sign-In for mobile
      // Use expo-auth-session or @react-native-google-signin/google-signin
      // For now, this will attempt the web flow which won't work properly on native
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
      Alert.alert(
        "Sign In Failed",
        "Mobile Google Sign-In needs to be configured. See packages/core/src/services/auth.ts"
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
      Alert.alert("Error", "Failed to sign out");
    }
  };

  const handleCreateProject = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill in title and description");
      return;
    }

    setIsCreating(true);
    try {
      await createProject({
        title: title.trim(),
        description: description.trim(),
        frequency,
        resultsDestination: "email",
      });

      // Clear form
      setTitle("");
      setDescription("");
      setFrequency("daily");

      Alert.alert("Success", "Project created!");
    } catch (error) {
      console.error("Failed to create project:", error);
      Alert.alert("Error", "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <Text variant="title">Research Assistant</Text>
          <Text style={styles.subtitle}>
            Set up recurring research projects and get results delivered to you
          </Text>
          <Text style={styles.noteText}>
            Note: Google Sign-In on mobile requires additional setup. See
            README.md
          </Text>
          <Button
            title="Sign in with Google"
            onPress={handleSignIn}
            style={styles.signInButton}
          />
        </View>
      </Screen>
    );
  }

  // Authenticated
  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text variant="title">Research Assistant</Text>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="secondary"
          style={styles.signOutButton}
        />
      </View>

      <Text style={styles.welcomeText}>
        Welcome, {user.displayName || user.email}!
      </Text>

      {/* New Project Form */}
      <View style={styles.formSection}>
        <Text variant="title" style={styles.sectionTitle}>
          Create New Project
        </Text>

        <Input
          label="Project Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., AI Research Updates"
        />

        <Input
          label="What to search for"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g., Latest developments in AI and machine learning"
          multiline
          numberOfLines={3}
        />

        <Picker
          label="Frequency"
          value={frequency}
          onValueChange={setFrequency}
          options={[
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
          ]}
        />

        <Button
          title={isCreating ? "Creating..." : "Create Project"}
          onPress={handleCreateProject}
          disabled={isCreating}
          style={styles.createButton}
        />
      </View>

      {/* Projects List */}
      <View style={styles.projectsSection}>
        <Text variant="title" style={styles.sectionTitle}>
          Your Projects
        </Text>

        {projectsLoading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : projects.length === 0 ? (
          <Text style={styles.emptyText}>
            No projects yet. Create your first one above!
          </Text>
        ) : (
          projects.map((project) => (
            <View key={project.id} style={styles.projectCard}>
              <Text style={styles.projectTitle}>{project.title}</Text>
              <Text style={styles.projectDescription}>
                {project.description}
              </Text>
              <View style={styles.projectMeta}>
                <Text variant="caption">Frequency: {project.frequency}</Text>
                <Text variant="caption">
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
  },
  subtitle: {
    textAlign: "center",
    marginVertical: 20,
    maxWidth: 400,
  },
  noteText: {
    textAlign: "center",
    marginVertical: 10,
    maxWidth: 400,
    fontSize: 12,
    color: "#FF6B00",
    fontStyle: "italic",
  },
  signInButton: {
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  signOutButton: {
    minWidth: 80,
  },
  welcomeText: {
    marginBottom: 30,
    fontSize: 16,
    color: "#666666",
  },
  formSection: {
    marginBottom: 40,
    padding: 20,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 20,
  },
  createButton: {
    marginTop: 10,
  },
  projectsSection: {
    marginBottom: 40,
  },
  emptyText: {
    textAlign: "center",
    color: "#999999",
    fontStyle: "italic",
    marginVertical: 20,
  },
  projectCard: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 12,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000000",
  },
  projectDescription: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  projectMeta: {
    marginTop: 8,
  },
});
