import { ask } from "../tools/llm/llm";
import { db } from "../db";
import { runTool } from "../tools/index";
import { buildPrompt } from "./prompt";
import { extractJSON } from "./utils";
import { AgentContext, Task } from "../types/agentType";
import {
    updateState,
    updateHistory,
} from "../database/agentRuns";



async function planAndSolve(prompt: string, id: number, ctx: AgentContext) {
    const ctxString = JSON.stringify(ctx, null, 2);
    const processedPrompt = buildPrompt(prompt, ctxString);
    console.log('Processed Prompt:', processedPrompt);

    // planning and task updating phase
    const response = await ask(processedPrompt);
    ctx = extractJSON(response);

    console.log('Context:', ctx);

    if (ctx.state === "done") {
        await updateState(id, ctx);
        await updateHistory(id, prompt, ctx);
        return ctx;
    }

    // task execution phase
    while (true) {
        const pendingTasks: Task[] = ctx.tasks.filter(
            task => task.status === "todo"
        );

        if (pendingTasks.length === 0) {
            break;
        }
        const task = pendingTasks[0];
        task.status = "inprogress";
        const taskResult = await runTool(task.tool_name, task.args);
        task.output = taskResult;
        task.status = "done";

        await updateState(id, ctx);
        await updateHistory(id, prompt, ctx);

        ctx = await planAndSolve(prompt, id, ctx);
    }

    ctx.state = "done";
    return ctx;
}

export async function agent(prompt: string, id: number) {
    let ctx: AgentContext = {
        state: "plan",
        tasks: [],
    };
    return await planAndSolve(prompt, id, ctx);
}