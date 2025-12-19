import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: "AIzaSyCNOtCWfq5fkejSNJZ5maWxu78-NdD9Dqk",
  baseURL: process.env.OPENAI_BASE_URL,
});

export default ai;
