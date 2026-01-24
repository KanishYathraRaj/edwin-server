export type AgentContext = {
    state: "plan" | "solve" | "done";
    tasks: Task[];
    canvas?: string;
    response?: string;
}

export type Task = {
    task_name: string;
    tool_name: string;
    args: object;
    status: "todo" | "inprogress" | "done";
    output?: any;
}