import { string } from "zod"
import { db } from "../../lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { searchRecords } from "../../rag/pineconeRAG";

export async function buildPrompt(message: string, userId: string, courseId: string) {

    let courseRef = doc(db, "users", userId, "courses", courseId);
    let courseSnap = await getDoc(courseRef);
    let course = courseSnap.data();

    let courseMaterial = await searchRecords(message, { courseId: courseId });

    console.log(courseMaterial.result.hits);

    let prompt = `Your a Teacher Assistant. 
    You are helping a teacher with their course. 
    The course is ${course?.title}. 
    The teacher's question is ${message}. 
    Answer the teacher's question based on the course material. 
    If the answer is not in the course material, say so.
    
    Course Material: ${courseMaterial.result.hits.map((hit: any) => hit.fields.chunk_text).join('\n')}
    
    Answer the teacher's question properly
    Your response should in proper markdown format.`

    return prompt;
}