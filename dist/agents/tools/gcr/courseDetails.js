"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseDetailsTool = void 0;
const zod_1 = require("zod");
const googleAuth_1 = require("./auth/googleAuth");
exports.courseDetailsTool = {
    name: "course-details",
    schema: {
        courseId: zod_1.z.string()
    },
    handler: async ({ courseId }) => {
        var _a;
        const classroom = await (0, googleAuth_1.getClassroomClient)();
        const course = await classroom.courses.get({ id: courseId });
        const announcements = await classroom.courses.announcements.list({ courseId });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        course: course.data,
                        announcements: (_a = announcements.data.announcements) !== null && _a !== void 0 ? _a : []
                    }, null, 2)
                }]
        };
    }
};
