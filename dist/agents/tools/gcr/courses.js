"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesTool = void 0;
const googleAuth_1 = require("./auth/googleAuth");
exports.coursesTool = {
    name: "courses",
    schema: {},
    handler: async () => {
        var _a;
        const classroom = await (0, googleAuth_1.getClassroomClient)();
        const res = await classroom.courses.list();
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify((_a = res.data.courses) !== null && _a !== void 0 ? _a : [])
                }]
        };
    }
};
