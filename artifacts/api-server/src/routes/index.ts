import { Router, type IRouter } from "express";
import healthRouter from "./health";
import youtubeRouter from "./youtube";
import mizanRouter from "./mizan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(youtubeRouter);
router.use(mizanRouter);

export default router;
