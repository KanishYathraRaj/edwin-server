"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agent = agent;
const llm_1 = require("../workflows/agent-chat/llm/llm");
const index_1 = require("./tools/index");
const prompt_1 = require("./prompt");
const utils_1 = require("./utils");
async function planAndSolve(prompt, id, ctx) {
    const ctxString = JSON.stringify(ctx, null, 2);
    const processedPrompt = (0, prompt_1.buildPrompt)(prompt, ctxString);
    const response = await (0, llm_1.ask)(processedPrompt);
    ctx = (0, utils_1.extractJSON)(response);
    if (ctx.state === "done")
        return ctx;
    const task = ctx.tasks.find(t => t.status === "todo");
    if (task) {
        task.status = "inprogress";
        const taskResult = await (0, index_1.runTool)(task.tool_name, task.args);
        task.output = taskResult;
        task.status = "done";
        return planAndSolve(prompt, id, ctx);
    }
    return ctx;
}
async function agent(prompt, id) {
    let ctx = {
        state: "plan",
        tasks: []
    };
    console.log("Initial Context", ctx);
    ctx = await planAndSolve(prompt, id, ctx);
    console.log("Final Context", ctx);
    return ctx;
}
