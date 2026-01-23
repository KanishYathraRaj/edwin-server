import { z } from "zod";
import { getClassroomClient } from "./auth/googleAuth";

export const courseDetailsTool = {
    name: "course-details",
    schema: {
        courseId: z.string()
    },
    handler: async ({ courseId }: { courseId: string }) => {
        const classroom = await getClassroomClient();

        const course = await classroom.courses.get({ id: courseId });
        const announcements =
            await classroom.courses.announcements.list({ courseId });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    course: course.data,
                    announcements: announcements.data.announcements ?? []
                }, null, 2)
            }]
        };
    }
};
