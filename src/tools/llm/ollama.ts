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