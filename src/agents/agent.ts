import { ask } from "../tools/llm/llm";
import { db } from "../db";
import { runTool } from "../tools/index";
import { buildPrompt } from "./prompt";
import { extractJSON } from "./utils";
import { AgentContext, Task } from "../types/agentType";
import {
    updateState,
    updateHistory,
    readState
} from "../database/agentRuns";

async function planAndSolve(prompt: string, id: number, ctx: AgentContext) {
    const ctxString = JSON.stringify(ctx, null, 2);
    const processedPrompt = buildPrompt(prompt, ctxString);
    const response = await ask(processedPrompt);
    ctx = extractJSON(response);
    if (ctx.state === "done") return ctx;
    const task = ctx.tasks.find(t => t.status === "todo")
    if (task) {
        task.status = "inprogress";
        const taskResult = await runTool(task.tool_name, task.args);
        task.output = taskResult;
        task.status = "done";
        return planAndSolve(prompt, id, ctx);
    }
    return ctx;
}

export async function agent(prompt: string, id: number) {
    let ctx: AgentContext = await readState(id);
    console.log("Initial Context", ctx);
    ctx = await planAndSolve(prompt, id, ctx);
    console.log("Final Context", ctx);
    await updateState(id, ctx);
    await updateHistory(id, prompt, ctx);
    return ctx;
}