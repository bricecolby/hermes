export const dummyMcq = {
  type: "mcq_v1.basic",
  mode: "reception",
  skills: ["reading"],
  conceptIds: [123],
  prompt: "Где метро?",
  choices: [
    { id: "A", text: "Там" },
    { id: "B", text: "Здесь" },
    { id: "C", text: "Сейчас" },
    { id: "D", text: "Потом" },
  ],
  correctChoiceId: "B",
};
