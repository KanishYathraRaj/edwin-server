export async function ask(prompt: string) {
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama3.2",
            prompt: prompt,
            stream: false,
        }),
    });
    const data = await response.json();
    return data.response;
}

export async function* askStream(prompt: string): AsyncGenerator<string> {
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama3.2",
            prompt: prompt,
            stream: true,
        }),
    });

    if (!response.body) {
        throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        yield json.response;
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}