import { ask } from "../tools/llm/llm";
import { db } from "../db";
import { updateAgentRunState } from "../database/agentRuns";


function buildPrompt(prompt: string, memory: string) {
    return `
    You are an AI agent that assists teachers with their workflows.

    You operate in TWO distinct phases: PLAN and SOLVE.

    ────────────────────────────────────────
    PHASE 1: PLAN
    ────────────────────────────────────────
    Your job in the PLAN phase is to:

    - Analyze the user request
    - Break it down into an ordered list of tasks
    - Decide which tools are needed and in what sequence
    - Do NOT execute any tool
    - Do NOT generate final content

    Rules for PLAN:

    - State MUST be "plan"
    - Tasks must be dependency-safe and ordered
    - Each task must use ONE tool
    - Tool outputs may be referenced by later tasks
    - If required information is missing, add a task to fetch it
    - Assume tool results will be injected back into context later

    ────────────────────────────────────────
    PHASE 2: SOLVE
    ────────────────────────────────────────
    Your job in the SOLVE phase is to:

    - Execute the planned tasks step by step
    - Call tools exactly as planned
    - Use tool outputs to update the canvas
    - Produce the final outcome

    Rules for SOLVE:

    - State MUST be "solve"
    - Execute tasks in order
    - Update task status correctly
    - Do NOT re-plan unless explicitly required
    - The canvas must contain the final teacher-facing content

    ________________________________________
    CURRENT MEMORY
    ________________________________________
    
    ${memory}

    ────────────────────────────────────────
    AVAILABLE TOOLS
    ────────────────────────────────────────

    - ask_llm(prompt: string) → returns markdown content
    - get_google_classroom_course_list
    - get_google_classroom_student_list
    - upload_document_to_google_classroom(course_id: string, content: string)

    ────────────────────────────────────────
    OUTPUT FORMAT (STRICT)
    ────────────────────────────────────────
    Respond in JSON ONLY, following this schema:

    {
        "state": "plan" | "solve",
        "tasks": [
            {
                "task_name": string,
                "tool_name": string,
                "args": object,
                "status": "todo" | "inprogress" | "done"
            }
        ],
        "canvas": "<markdown formatted string>",
        "response": "Anything regarding the plan you want to say to the user"
    }

    ────────────────────────────────────────
    IMPORTANT RULES
    ────────────────────────────────────────

    - No text outside JSON
    - No explanations
    - No markdown outside canvas
    - Canvas is empty in PLAN phase
    - Canvas contains final content in SOLVE phase
    - upload_document_to_google_classroom MUST use canvas as content

    User Prompt: 
    ${prompt}
    `
}

async function updateState(id: number, state: object) {
    db.query(
        `UPDATE agent_runs SET state = $1 WHERE id = $2`,
        [JSON.stringify(state), id]
    );
}

async function updateHistory(id: number, userPrompt: string, aiResponse: object) {
    try {
        // First, get the current memory to check if history exists
        const result = await db.query(
            `SELECT memory FROM agent_runs WHERE id = $1`,
            [id]
        );

        const currentMemory = result.rows[0]?.memory || {};
        const currentHistory = currentMemory.history || [];

        // Create new history entry
        const newHistoryEntry = {
            timestamp: new Date().toISOString(),
            userPrompt,
            aiResponse
        };

        // Append to history array
        const updatedHistory = [...currentHistory, newHistoryEntry];

        // Update the memory with the new history
        await db.query(
            `UPDATE agent_runs 
             SET memory = jsonb_set(
                 COALESCE(memory, '{}'::jsonb),
                 '{history}',
                 $1::jsonb
             )
             WHERE id = $2`,
            [JSON.stringify(updatedHistory), id]
        );

        console.log('History updated successfully for agent run:', id);
    } catch (error) {
        console.error('Error updating history:', error);
        throw error;
    }
}

async function readMemory(id: number) {
    const result = await db.query(
        `SELECT memory FROM agent_runs WHERE id = $1`,
        [id]
    );
    return result.rows[0]?.memory || {};
}

export async function agent(prompt: string, id: number) {
    try {
        // Building the prompt
        const memory = await readMemory(id);
        const memoryString = JSON.stringify(memory, null, 2);
        const processedPrompt = buildPrompt(prompt, memoryString);
        console.log('Processed Prompt:', processedPrompt);

        // Call the LLM
        const answer = await ask(processedPrompt);
        console.log('Answer:', answer);
        const answer_json = JSON.parse(answer);

        // Update state and history
        await updateState(id, answer_json);
        await updateHistory(id, prompt, answer_json);

        return answer_json;
    } catch (error) {
        console.error('Error in agent:', error);
        throw error;
    }
}