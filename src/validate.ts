import { z } from "zod";
import { badRequest } from "./errors";

export const uuidSchema = z.string().uuid();

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("; ");
    throw badRequest(message);
  }
  return result.data;
}
