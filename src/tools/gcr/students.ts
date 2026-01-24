import { z } from "zod";
import { getClassroomClient } from "./auth/googleAuth";

export const studentsTool = {
    name: "get_google_classroom_student_list",
    schema: {
        courseId: z.string()
    },
    handler: async ({ courseId }: { courseId: string }) => {
        const classroom = await getClassroomClient();

        const res = await classroom.courses.students.list({ courseId });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(res.data.students ?? [], null, 2)
            }]
        };
    }
};
