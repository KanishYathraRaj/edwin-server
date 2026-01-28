"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tools = void 0;
exports.runTool = runTool;
const courses_1 = require("./gcr/courses");
const students_1 = require("./gcr/students");
const createAssignment_1 = require("./gcr/createAssignment");
const llm_1 = require("./llm/llm");
exports.tools = [
    {
        name: "get_google_classroom_course_list",
        originalTool: courses_1.coursesTool
    },
    {
        name: "get_google_classroom_student_list",
        originalTool: students_1.studentsTool
    },
    {
        name: "upload_document_to_google_classroom",
        originalTool: createAssignment_1.createAssignmentTool
    },
    {
        name: "ask_llm",
        originalTool: llm_1.askLlmTool
    }
];
async function runTool(toolName, args) {
    const toolDef = exports.tools.find(t => t.name === toolName);
    if (!toolDef) {
        throw new Error(`Tool ${toolName} not found`);
    }
    console.log(`Running tool: ${toolName} with args:`, args);
    return toolDef.originalTool.handler(args);
}
