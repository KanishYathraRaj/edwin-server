"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentsTool = void 0;
const zod_1 = require("zod");
const googleAuth_1 = require("./auth/googleAuth");
exports.assignmentsTool = {
    name: "assignments",
    schema: {
        courseId: zod_1.z.string()
    },
    handler: async ({ courseId }) => {
        var _a;
        const classroom = await (0, googleAuth_1.getClassroomClient)();
        const work = await classroom.courses.courseWork.list({ courseId });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify((_a = work.data.courseWork) !== null && _a !== void 0 ? _a : [], null, 2)
                }]
        };
    }
};
