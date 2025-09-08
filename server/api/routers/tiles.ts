import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const tilesRouter = createTRPCRouter({
  all: publicProcedure
    .input(
      z.object({
        mapId: z.string(),
        page: z.number().default(0),
        count: z.number().default(100),
      })
    )
    .query(() => {}),
  upsert: publicProcedure.input(z.object({})).mutation(() => {}),
});
