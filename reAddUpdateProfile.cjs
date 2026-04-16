const fs = require("fs");
let content = fs.readFileSync("auth.js", "utf8");

const missingFunctions = `
/**
 * Update user profile (e.g., during onboarding or settings)
 */
async function updateUserProfile(userId, data) {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update(data)
            .eq('id', userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Update profile error:", error.message);
        return { success: false, error: error.message };
    }
}
`;

if(!content.includes("async function updateUserProfile")) {
  // insert before getUserById or somewhere safe
  if(content.includes("async function getUserById")) {
      content = content.replace("async function getUserById", missingFunctions + "\nasync function getUserById");
  } else {
      content = content + "\n" + missingFunctions;
  }
  fs.writeFileSync("auth.js", content);
  console.log("Restored missing updateUserProfile function");
} else {
  console.log("Function already exists");
}
