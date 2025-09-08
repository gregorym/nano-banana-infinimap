import { prisma } from "@/lib/prisma";
import z from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const mapsRouter = createTRPCRouter({
  all: protectedProcedure.query(async ({ input, ctx }) => {
    const map = await prisma.map.findMany({
      where: {
        userId: ctx.session?.user.id,
      },
    });

    return map;
  }),
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const map = await prisma.map.findUnique({
        where: {
          id: input.id,
        },
      });

      return map;
    }),
  create: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    const map = await prisma.map.create({
      data: {
        userId: ctx.session.user.id,
      },
    });

    await prisma.userMap.create({
      data: {
        userId: ctx.session.user.id,
        mapId: map.id,
      },
    });

    return map;
  }),
});
