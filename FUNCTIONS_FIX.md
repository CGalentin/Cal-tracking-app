# Fix for functions/src/index.ts (PR 18)

The `onImageMessageCreated` function has duplicate/orphaned code from the error-handling refactor.

**Current state:** The visionMsgRef content was partially fixed, but **line 420** has a malformed syntax (stray `'timestamp` merged with the previous line). The duplicate block (lines 424–452) still needs removal.

## Quick fix (run in CMD or external terminal)

From the project root, run:
```bash
python C:\temp\fix_final.py
```
Or:
```bash
node C:\temp\fix.js
```

Note: The integrated terminal may fail due to the apostrophe in `Chris's Home`; use an external Command Prompt or PowerShell window.

## Manual fix

1. **Fix line 420**  
   Find:
   ```ts
   ...(estimatedCalories != null && { estimatedCalories }),'timestamp: admin.firestore.FieldValue.serverTimestamp(),
   ```  
   (The `'` may be a curly apostrophe; copy it from the file.)  
   Replace with:
   ```ts
   ...(estimatedCalories != null && { estimatedCalories }),
   timestamp: admin.firestore.FieldValue.serverTimestamp(),
   ```

2. **Remove the duplicate block (lines 424–452)**  
   Delete from:
   ```ts
   await messagesRef.add({
     role: "assistant",
     type: "text",
     text: "I couldn't analyze the image right now. Please try again.",
     ...
   return;
   }
   const description = visionResult.text;
   ... (duplicate block through second visionMsgRef and imageMessageId)
   ```
   Keep only the first `visionMsgRef`, first `imageMessageId`, and the **confirmation** `await messagesRef.add({...})`.

3. **Verify**  
   Run `cd functions && npm run build`
