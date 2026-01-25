
import { coursesTool } from "./gcr/courses";
import { courseDetailsTool } from "./gcr/courseDetails";
import { assignmentsTool } from "./gcr/assignments";
import { studentsTool } from "./gcr/students";
import { createAssignmentTool } from "./gcr/createAssignment";
import { askLlmTool } from "./llm/llm";

export const tools = [
    {
        name: "get_google_classroom_course_list",
        originalTool: coursesTool
    },
    {
        name: "get_google_classroom_student_list",
        originalTool: studentsTool
    },
    {
        name: "upload_document_to_google_classroom",
        originalTool: createAssignmentTool
    },
    {
        name: "ask_llm",
        originalTool: askLlmTool
    }
];

export async function runTool(toolName: string, args: any) {
    const toolDef = tools.find(t => t.name === toolName);
    if (!toolDef) {
        throw new Error(`Tool ${toolName} not found`);
    }
    console.log(`Running tool: ${toolName} with args:`, args);
    return toolDef.originalTool.handler(args);
}
