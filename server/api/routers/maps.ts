import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const mapsRouter = createTRPCRouter({
  get: publicProcedure.input(z.object({ id: z.string() })).query(() => {}),
  create: publicProcedure.input(z.object({})).mutation(() => {}),
});
