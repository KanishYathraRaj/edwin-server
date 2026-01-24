import { z } from "zod";
import { getClassroomClient } from "./auth/googleAuth";

export const createAssignmentTool = {
    name: "upload_document_to_google_classroom",
    schema: {
        courseId: z.string(),
        content: z.string().describe("The description or content of the assignment")
    },
    handler: async ({ courseId, content }: { courseId: string, content: string }) => {
        const classroom = await getClassroomClient();

        // Create the coursework
        const res = await classroom.courses.courseWork.create({
            courseId,
            requestBody: {
                title: "Agent Generated Assignment",
                description: content,
                workType: "ASSIGNMENT",
                state: "PUBLISHED", // Or DRAFT
            }
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(res.data, null, 2)
            }]
        };
    }
};
