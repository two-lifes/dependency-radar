import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { requireSession, viewerOf } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getProjectSettings, type ProjectSettings } from "@/server/db/projects";

const idSchema = z.uuid();

/**
 * The project for its settings page, or a 404 for a malformed id and for
 * someone else's project (decisions 45). Cached per request: the layout
 * calls it before anything streams, so the 404 has a real status, and the
 * page reuses the same answer.
 */
export const loadProjectSettings = cache(
  async (id: string): Promise<ProjectSettings> => {
    if (!idSchema.safeParse(id).success) notFound();
    const session = await requireSession();
    const project = await getProjectSettings(getDb(), id, viewerOf(session));
    if (!project) notFound();
    return project;
  },
);
