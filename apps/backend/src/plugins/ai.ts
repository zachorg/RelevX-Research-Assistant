import fp from "fastify-plugin";

export default fp(async (app: any) => {
  try {
    // Validate API keys
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      throw new Error("Missing required API keys OPENAI_API_KEY");
    }

    // Import provider classes and setup function from core package
    const { OpenAIProvider } = await import("core");

    // Create provider instances
    const llmProvider = new OpenAIProvider(openaiKey);

    app.decorate("aiInterface", llmProvider);
  } catch (error: any) {
    throw error;
  }
});
