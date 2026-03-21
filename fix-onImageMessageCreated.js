/**
 * Fix onImageMessageCreated duplicate block in functions/src/index.ts
 * Run: node fix-onImageMessageCreated.js (from project root)
 */
const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "functions", "src", "index.ts");
let content = fs.readFileSync(filePath, "utf8");

// 1. Fix malformed line 420: "}),'timestamp:" or "}),'timestamp:" -> "}),\n        timestamp:"
content = content.replace(/\}\),[\u2019']timestamp:/g, "}),\n        timestamp:");

// 2. Remove wrong add + return + orphan } + duplicate block. Keep: imageMessageId, confirmation add.
const badBlock = /      await messagesRef\.add\(\{\s*role: "assistant",\s*type: "text",\s*text: "I couldn[\u2019']t analyze the image right now\. Please try again\.",[\s\S]*?\}\);\s*return;\s*\}\s*\n\s*const description = visionResult\.text;[\s\S]*?const imageMessageId = event\.params\.messageId;\n\s*await messagesRef\.add\(\{\s*role: "assistant",\s*type: "confirmation",/;

if (badBlock.test(content)) {
  content = content.replace(badBlock, "      await messagesRef.add({\n        role: \"assistant\",\n        type: \"confirmation\",");
  console.log("Removed duplicate block");
}

fs.writeFileSync(filePath, content);
console.log("Done. Run: cd functions && npm run build");
