const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "functions", "src", "index.ts");
let content = fs.readFileSync(filePath, "utf8");

// Pattern: from first wrong visionMsgRef through duplicate block to (but not including) the confirmation add
const badBlock = `      const visionMsgRef = await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "I couldn't process that image. Please try another photo.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      const imageMessageId = event.params.messageId;
      if (!visionResult) {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "I couldn't analyze the image right now. Please try again.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

      const description = visionResult.text;
      const { foods: foodItems, estimatedCalories } = parseVisionResponse(description);
      const confidenceScore = 0.85;

      const messageParts: string[] = [];
      if (foodItems.length > 0) {
        messageParts.push(\`I see: \${foodItems.join(", ")}.\`);
        if (estimatedCalories != null) {
          messageParts.push(\`Estimated: \${formatNutritionSummary(estimatedCalories)}\`);
        }
      } else {
        messageParts.push(description);
        if (estimatedCalories != null) {
          messageParts.push(\`Estimated: \${formatNutritionSummary(estimatedCalories)}\`);
        }
      }

      logger.info("Vision result", {
      conversationId,
      description: description.slice(0, 100),
      foodCount: foodItems.length,
      estimatedCalories: estimatedCalories ?? undefined,
    });

      const visionMsgRef = await messagesRef.add({
        role: "assistant",
        type: "text",
        text: messageParts.join(" "),
        foodDescription: description,
        foodItems,
        confidenceScore,
        ...(estimatedCalories != null && { estimatedCalories }),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      const imageMessageId = event.params.messageId;
`;

const goodBlock = `      const visionMsgRef = await messagesRef.add({
        role: "assistant",
        type: "text",
        text: messageParts.join(" "),
        foodDescription: description,
        foodItems,
        confidenceScore,
        ...(estimatedCalories != null && { estimatedCalories }),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      const imageMessageId = event.params.messageId;
`;

// Use regex to handle both straight (') and curly (') apostrophes in "couldn't"
// Match from wrong visionMsgRef through duplicate block (but NOT the confirmation add)
const badRegex = /      const visionMsgRef = await messagesRef\.add\(\{\s*role: "assistant",\s*type: "text",\s*text: "I couldn['\u2019]t process that image\. Please try another photo\.",\s*timestamp: admin\.firestore\.FieldValue\.serverTimestamp\(\),\s*\}\);\s*const imageMessageId = event\.params\.messageId;\s*await messagesRef\.add\(\{\s*role: "assistant",\s*type: "text",\s*text: "I couldn['\u2019]t analyze the image right now\. Please try again\.",\s*timestamp: admin\.firestore\.FieldValue\.serverTimestamp\(\),\s*\}\);\s*return;\s*\}\s*const description = visionResult\.text;[\s\S]*?const visionMsgRef = await messagesRef\.add\(\{\s*role: "assistant",\s*type: "text",\s*text: messageParts\.join\(" "\),\s*foodDescription: description,\s*foodItems,\s*confidenceScore,[\s\S]*?\}\);\s*const imageMessageId = event\.params\.messageId;\s*/;
if (badRegex.test(content)) {
  content = content.replace(badRegex, goodBlock);
  console.log("Fixed");
} else {
  console.log("Pattern not found");
  process.exit(1);
}

fs.writeFileSync(filePath, content);
console.log("Done");
