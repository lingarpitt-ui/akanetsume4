// --- NEW V2 IMPORTS ---
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const fetch = require("node-fetch");

initializeApp();

// --- HELPER FUNCTION: callGemini (for text) ---
const callGemini = async (prompt) => {
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        throw new HttpsError('failed-precondition', 'The Gemini API key is not configured.');
    }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API call failed:", errorBody);
        throw new HttpsError('internal', `API call failed with status: ${response.status}. Body: ${errorBody}`);
    }
    return response.json();
};

// --- HELPER FUNCTION: callGeminiWithFile (for resumes) ---
const callGeminiWithFile = async (prompt, fileData, mimeType) => {
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        throw new HttpsError('failed-precondition', 'The Gemini API key is not configured.');
    }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [
        { 
          parts: [
            { text: prompt },
            { 
              inline_data: {
                mime_type: mimeType,
                data: fileData 
              }
            }
          ]
        }
      ]
    };
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API call with file failed:", errorBody);
        throw new HttpsError('internal', `API call failed with status: ${response.status}. Body: ${errorBody}`);
    }
    return response.json();
};


// --- 1. GENERATE SKILLS (v2 Syntax) ---
exports.generateSkills = onCall({ secrets: ["GEMINI_KEY"] }, async (request) => {
    const { jobTitle } = request.data; 
    if (!jobTitle) {
        throw new HttpsError('invalid-argument', 'The function must be called with one argument "jobTitle".');
    }
    const prompt = `Generate 6 to 10 relevant skill attributes for a "${jobTitle}". Return the response as a JSON array of strings. For example: ["Skill 1", "Skill 2"].`;
    
    try {
        const result = await callGemini(prompt);
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in generateSkills function:", error);
        throw new HttpsError('internal', error.message);
    }
});

// --- 2. VALIDATE SKILL WITH AI (v2 Syntax) ---
exports.validateSkillWithAI = onCall({ secrets: ["GEMINI_KEY"] }, async (request) => {
    const { skill } = request.data; // <--- THIS IS THE FIX
    if (!skill) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "skill" object.');
    }
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
    try {
        const result = await callGemini(prompt);
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in validateSkillWithAI function:", error);
        throw new HttpsError('internal', error.message);
    }
});

// --- 3. EXTRACT RESUME DATA (v2 Syntax) ---
exports.extractResumeData = onCall({ secrets: ["GEMINI_KEY"] }, async (request) => {
    console.log("Validating Gemini API Key...");
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        console.error("Validation Error: process.env.GEMINI_KEY is undefined or null.");
        throw new HttpsError(
          'failed-precondition', 
          'Gemini key validation failed: process.env.GEMINI_KEY is undefined or null. Please re-deploy your functions.'
        );
    }
  
    console.log("Validation passed. Processing request.");
    const { fileData, mimeType } = request.data;
    if (!fileData || !mimeType) {
        throw new HttpsError('invalid-argument', 'The function must be called with "fileData" and "mimeType".');
    }

    const prompt = `
        Analyze the provided resume document and extract the employment history. 
        Return the data as a valid JSON array of objects. ... (rest of your prompt)
    `;

    try {
        const result = await callGeminiWithFile(prompt, fileData, mimeType); 
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in callGemini or processing:", error);
        throw new HttpsError('internal', error.message);
    }
});


// --- 4. GENERATE SUMMARY WITH AI (v2 Syntax) ---
exports.generateSummaryWithAI = onCall({ secrets: ["GEMINI_KEY"] }, async (request) => {
    const { allProofPoints } = request.data; // <--- THIS IS THE FIX
    if (typeof allProofPoints !== 'string') {
        throw new HttpsError('invalid-argument', 'The function must be called with one argument "allProofPoints" as a string.');
    }
    const prompt = `Write a 100-150 word professional summary for a candidate based on the following skills and experiences:\n\n${allProofPoints}`;

    try {
        const result = await callGemini(prompt);
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error in generateSummaryWithAI function:", error);
        throw new HttpsError('internal', error.message);
    }
});