"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssignmentTool = void 0;
const zod_1 = require("zod");
const googleAuth_1 = require("./auth/googleAuth");
exports.createAssignmentTool = {
    name: "upload_document_to_google_classroom",
    schema: {
        courseId: zod_1.z.string(),
        content: zod_1.z.string().describe("The description or content of the assignment")
    },
    handler: async ({ courseId, content }) => {
        const classroom = await (0, googleAuth_1.getClassroomClient)();
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
