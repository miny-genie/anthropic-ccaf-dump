import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sourcesRouter from "./sources";
import dashboardRouter from "./dashboard";
import attemptsRouter from "./attempts";
import bookmarksRouter from "./bookmarks";
import wrongAnswersRouter from "./wrongAnswers";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sourcesRouter);
router.use(dashboardRouter);
router.use(attemptsRouter);
router.use(bookmarksRouter);
router.use(wrongAnswersRouter);
router.use(notesRouter);

export default router;
