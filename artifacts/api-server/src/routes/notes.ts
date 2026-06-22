import { Router, type IRouter } from "express";
import { SetNoteBody, SetNoteResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { setNote } from "../lib/notes";

const router: IRouter = Router();

router.put("/notes", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const body = SetNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const note = await setNote(
    userId,
    body.data.questionId,
    body.data.note ?? null,
  );
  res.json(SetNoteResponse.parse({ questionId: body.data.questionId, note }));
});

export default router;
