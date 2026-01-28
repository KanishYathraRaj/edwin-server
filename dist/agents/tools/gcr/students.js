"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentsTool = void 0;
const zod_1 = require("zod");
const googleAuth_1 = require("./auth/googleAuth");
exports.studentsTool = {
    name: "get_google_classroom_student_list",
    schema: {
        courseId: zod_1.z.string()
    },
    handler: async ({ courseId }) => {
        var _a;
        const classroom = await (0, googleAuth_1.getClassroomClient)();
        const res = await classroom.courses.students.list({ courseId });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify((_a = res.data.students) !== null && _a !== void 0 ? _a : [], null, 2)
                }]
        };
    }
};
