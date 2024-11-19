import { z } from "zod";

export const imagePromptRequestSchema = z.object({
    prompt: z.string()
});

export type ImagePromptRequest = z.infer<typeof imagePromptRequestSchema>;

export const imagePromptResponseSchema = z.object({

});

export type ImagePromptResponse = z.infer<typeof imagePromptResponseSchema>;
