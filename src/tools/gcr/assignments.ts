import { z } from "zod";
import { getClassroomClient } from "./auth/googleAuth";

export const assignmentsTool = {
    name: "assignments",
    schema: {
        courseId: z.string()
    },
    handler: async ({ courseId }: { courseId: string }) => {
        const classroom = await getClassroomClient();

        const work = await classroom.courses.courseWork.list({ courseId });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(work.data.courseWork ?? [], null, 2)
            }]
        };
    }
};
