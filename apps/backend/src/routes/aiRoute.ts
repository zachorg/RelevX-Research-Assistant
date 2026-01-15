import type { FastifyPluginAsync } from "fastify";
import type {
  ImproveProjectDescriptionRequest,
  ImproveProjectDescriptionResponse,
} from "core";

// API key management routes: create/list/revoke. All routes rely on the auth
// plugin to populate req.userId and tenant authorization.
const routes: FastifyPluginAsync = async (app) => {
  const aiInterface = app.aiInterface;

  app.get("/healthz", async (_req, rep) => {
    return rep.send({ ok: true });
  });

  app.addHook("onClose", async () => {});

  app.post(
    "/improve-project-description",
    { preHandler: [app.rlPerRoute(5)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        }

        const request = req.body as ImproveProjectDescriptionRequest;
        if (!request.description) {
          return rep
            .status(400)
            .send({ error: { message: "Description is required" } });
        }
        const response = await aiInterface.query([
          {
            role: "user",
            content: `
You are a helpful assistant that improves project descriptions.
Project Description: ${request.description}
Constraints: 1). It should clearly state everything that needs to be researched. It should be specific and detailed. 2). Should not be 'This project aims', that is obvious. 3). Should be a list of items, not a paragraph.

Return ONLY a JSON object with this structure:
{
  "description": "the improved project description"
}
`,
          },
        ]);

        return rep.status(200).send({
          description: response.description,
        } as ImproveProjectDescriptionResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/ai/improve-project-description failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "Improve project description failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );
};

export default routes;
