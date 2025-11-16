const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { GoogleAuth } = require('google-auth-library');
const fetch = require("node-fetch"); // <-- Make sure this is node-fetch@2

// No initializeApp() here, we let it initialize by default
// for the (default) database, which is what your App.js uses.
initializeApp();

// A helper function to call the Vertex AI API
const callGemini = async (prompt, fileData = null, mimeType = null) => {
    
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const PROJECT_ID = "bkanetsume4"; // Your project
    const LOCATION = "us-central1"; 
    
    // --- THIS IS THE FIX ---
// Use the modern, correct model names

// --- THIS IS THE FIX ---
// Use the modern 'gemini-2.5-flash' model, which is available in us-central1
// and can handle both text and files (vision).
const model = "gemini-2.5-flash"; 

// The API_URL needs to point to the 'google' publisher
const API_URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;

    const parts = [{ text: prompt }];
    if (fileData && mimeType) {
        parts.push({
            inlineData: {
                data: fileData,
                mimeType: mimeType
            }
        });
    }
    const payload = { 
        contents: [{ role: "user", parts: parts }], // 'role: "user"' is now added
        generationConfig: {

            "maxOutputTokens": 2048,
            "temperature": 0.4,
            "topP": 1,
            "topK": 32
        }
    };

    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Vertex AI API call failed:", errorBody);
        // Use the imported HttpsError
        throw new HttpsError(
            'internal', 
            `API call failed with status: ${response.status}. Body: ${errorBody}`
        );
    }
    
    return response.json();
};


// --- ALL YOUR FUNCTIONS IN GEN 2 SYNTAX ---

exports.generateSkills = onCall({ region: "us-central1" }, async (request) => {
    const { jobTitle } = request.data; // Get data from request.data
    if (!jobTitle) {
        throw new HttpsError('invalid-argument', 'The function must be called with one argument "jobTitle".');
    }
    const prompt = `Generate 6 to 10 relevant skill attributes for a "${jobTitle}". Return the response as a JSON array of strings. For example: ["Skill 1", "Skill 2"].`;
    try {
        const result = await callGemini(prompt);
        if (!result.candidates || !result.candidates[0].content || !result.candidates[0].content.parts) {
            console.error("Invalid response structure from Gemini:", result);
            throw new HttpsError("internal", "Failed to parse response from AI.");
        }
        // Return the raw text
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in generateSkills function:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

exports.validateSkillWithAI = onCall({ region: "us-central1" }, async (request) => {
    const { skill } = request.data;
    if (!skill) {
         throw new HttpsError('invalid-argument', 'The function must be called with a "skill" object.');
    }
    
    // --- THIS IS THE CORRECT, FULL PROMPT ---
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };
    const prompt = `
        As a career coach, evaluate a user's self-assessed skill level based ONLY on the evidence they provided.
        Skill: "${skill.name}"
        Self-Assessed Level: ${skill.rating} (${ratingLabels[skill.rating]})
        Evidence - Proof Points: "${skill.proof || 'No proof points provided.'}"
        Evidence - Certifications: ${(skill.certifications && skill.certifications.length > 0) ? JSON.stringify(skill.certifications) : '"No certifications provided."'}
        Based on this evidence, is the self-assessed level justified?
        Respond with ONLY one of the following three options: "Strongly Supported", "Supported", or "Not Supported".
    `;
    // --- END OF FIX ---

    try {
        const result = await callGemini(prompt);
        if (!result.candidates || !result.candidates[0].content || !result.candidates[0].content.parts) {
            console.error("Invalid response structure from Gemini:", result);
            throw new HttpsError("internal", "Failed to parse response from AI.");
        }
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in validateSkillWithAI function:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

exports.generateSummaryWithAI = onCall({ region: "us-central1" }, async (request) => {
    const { allProofPoints } = request.data;
    if (typeof allProofPoints !== 'string') {
        throw new HttpsError('invalid-argument', 'The function must be called with one argument "allProofPoints" as a string.');
    }
    const prompt = `Write a 100-150 word professional summary for a candidate based on the following skills and experiences:\n\n${allProofPoints}`;
    try {
        const result = await callGemini(prompt);
        if (!result.candidates || !result.candidates[0].content || !result.candidates[0].content.parts) {
            console.error("Invalid response structure from Gemini:", result);
            throw new HttpsError("internal", "Failed to parse response from AI.");
        }
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in generateSummaryWithAI function:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

// This is the Gen 2 function from your file
exports.extractResumeData = onCall({ region: "us-central1" }, async (request) => {
    const { fileData, mimeType } = request.data;
    if (!fileData || !mimeType) {
        throw new HttpsError('invalid-argument', 'The function must be called with "fileData" and "mimeType".');
    }
    
    // --- THIS IS THE CORRECT, FULL PROMPT ---
    const prompt = `
        Analyze the provided resume document and extract the employment history. 
        Return the data as a valid JSON array of objects. Each object should represent one job and
        have keys: "company", "jobTitle", "startDate", "endDate", "city", and "description".
        - If end date is "Present", use "Present".
        - Summarize responsibilities into "description".
        
        IMPORTANT: Your response MUST be only the raw JSON array.
        Do NOT include any introductory text, markdown (like \`\`\`json\`), or explanations.
        Your response must start with '[' and end with ']'.
    `;
    // --- END OF FIX ---

    try {
        const result = await callGemini(prompt, fileData, mimeType);
        
        let rawText = result.candidates[0].content.parts[0].text;
        
        // Clean up any markdown, just in case
        let cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        // Find the first '[' and the last ']'
        const jsonStartIndex = cleanText.indexOf('[');
        const jsonEndIndex = cleanText.lastIndexOf(']');
        
        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            console.error("AI Response was not valid JSON:", cleanText);
            throw new Error("Could not find valid JSON array in AI response.");
        }

        const jsonString = cleanText.substring(jsonStartIndex, jsonEndIndex + 1);
        
        return jsonString;

    } catch (error) {
        console.error("Error in extractResumeData function:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});