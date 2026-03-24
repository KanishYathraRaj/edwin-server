import { ask, extractJSONFromLLM } from "../agent-chat/llm/llm";
import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { searchRecords } from "../../rag/pineconeRAG";

async function buildPrompt(message: string, userId: string, courseId: string) {

    let courseRef = doc(db, "users", userId, "courses", courseId);
    let courseSnap = await getDoc(courseRef);
    let course = courseSnap.data();

    // let courseMaterial = await searchRecords(message, { courseId: courseId });

    // console.log(courseMaterial.result.hits);

    let prompt = `Your a Teacher Assistant.
    You are helping a teacher with their course.
    The course is ${course?.title}.
    The teacher's instruction is ${message}.
    Your task is to generate a question bank for this course.
    
    Your response should be in below JSON format:
    Follow this Exact Format to generate the response:
    {
        "questions" : [
            "question no 1 ......?",
            "question no 2 ......?",
            "question no 3 ......?",
            "question no 4 ......?",
            "question no 5 ......?",
        ]
    }
    `
    return prompt;
}

export async function generateQuestionBank(instruction: string, userId: string, courseId: string) {
    let prompt = await buildPrompt(instruction, userId, courseId);
    let response = await ask(prompt);
    let questions = extractJSONFromLLM(response);
    return questions;
}