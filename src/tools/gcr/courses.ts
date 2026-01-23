import { getClassroomClient } from "./auth/googleAuth";


export const coursesTool = {
  name: "courses",
  schema: {},
  handler: async () => {
    const classroom = await getClassroomClient();
    const res = await classroom.courses.list();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(res.data.courses ?? [])
      }]
    };
  }
};
