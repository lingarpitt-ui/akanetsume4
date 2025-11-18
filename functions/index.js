const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { GoogleAuth } = require('google-auth-library');
const fetch = require("node-fetch"); 

initializeApp();

// --- HELPER FUNCTION ---
const callGemini = async (prompt, fileData = null, mimeType = null, safetySettings = [], responseType = "text/plain") => {
    
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    // --- PRODUCTION CONFIGURATION ---
    const PROJECT_ID = "bkanetsume4";  // <--- VERIFY THIS IS YOUR PROD ID
    const LOCATION = "us-central1"; 
    const model = "gemini-2.5-flash"; 
    const API_URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;

    const parts = [{ text: prompt }];
    if (fileData && mimeType) {
        parts.push({ inlineData: { data: fileData, mimeType: mimeType } });
    }

    const payload = { 
        contents: [{ role: "user", parts: parts }],
        generationConfig: {
            "maxOutputTokens": 8192, // Increased for long resumes
            "temperature": 0.4,
            "topP": 1,
            "topK": 32,
            "responseMimeType": responseType 
        },
        safetySettings: safetySettings 
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
        throw new HttpsError('internal', `API call failed with status: ${response.status}. Body: ${errorBody}`);
    }
    
    return response.json();
};

// --- 1. EXTRACT RESUME DATA (JOBS) ---
exports.extractResumeData = onCall({ region: "us-central1", timeoutSeconds: 120, memory: "1GiB" }, async (request) => {
    const { fileData, mimeType } = request.data;
    if (!fileData || !mimeType) {
        throw new HttpsError('invalid-argument', 'The function must be called with "fileData" and "mimeType".');
    }
    
    const prompt = `
        You are a data extraction engine. Analyze the resume and extract employment history.
        Return ONLY a JSON array of objects.
        Required JSON Structure:
        [
          { "company": "String", "jobTitle": "String", "startDate": "String", "endDate": "String", "city": "String", "description": "String (summary of duties)" }
        ]
        - If end date is "Present", use "Present".
        - DO NOT output markdown code blocks.
        - Output strictly valid JSON.
    `;
    
    const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];

    try {
        const result = await callGemini(prompt, fileData, mimeType, safetySettings, "application/json");
        const rawText = result.candidates[0].content.parts[0].text;
        let cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        const firstBracket = cleanText.indexOf('[');
        if (firstBracket === -1) {
            throw new Error("The AI response did not contain a valid JSON array.");
        }

        let lastBracket = cleanText.lastIndexOf(']');
        if (lastBracket === -1 || lastBracket < firstBracket) {
             const lastCurly = cleanText.lastIndexOf('}');
             if (lastCurly > firstBracket) {
                cleanText = cleanText.substring(0, lastCurly + 1) + "]";
                lastBracket = cleanText.length - 1;
            } else {
                throw new Error("JSON cut off too early to repair.");
            }
        }

        return cleanText.substring(firstBracket, lastBracket + 1);

    } catch (error) {
        console.error("Error in extractResumeData:", error);
        throw new HttpsError('internal', error.message);
    }
});

// --- 2. EXTRACT EDUCATION (THE MISSING FUNCTION) ---
exports.extractEducationData = onCall({ region: "us-central1", timeoutSeconds: 120, memory: "1GiB" }, async (request) => {
    const { fileData, mimeType } = request.data;
    if (!fileData || !mimeType) {
        throw new HttpsError('invalid-argument', 'The function must be called with "fileData" and "mimeType".');
    }
    
    const prompt = `
        Analyze the provided resume document and extract the Education, Degrees, Diplomas, and Certifications.
        Return the data as a valid JSON array of objects. 
        Keys: "name", "institute", "location", "year".
        IMPORTANT: Your response MUST be only the raw JSON array.
    `;

    const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];

    try {
        const result = await callGemini(prompt, fileData, mimeType, safetySettings, "application/json");
        const rawText = result.candidates[0].content.parts[0].text;
        let cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        
        if (firstBracket === -1 || lastBracket === -1) {
            throw new Error("Could not find valid JSON array in AI response.");
        }

        return cleanText.substring(firstBracket, lastBracket + 1);

    } catch (error) {
        console.error("Error in extractEducationData:", error);
        throw new HttpsError('internal', error.message);
    }
});

// --- 3. GENERATE SKILLS ---
exports.generateSkills = onCall({ region: "us-central1" }, async (request) => {
    const { jobTitle } = request.data;
    if (!jobTitle) throw new HttpsError('invalid-argument', 'Missing jobTitle.');
    
    const prompt = `Generate 6 to 10 relevant skill attributes for a "${jobTitle}". Return as JSON array of strings.`;
    try {
        const result = await callGemini(prompt, null, null, [], "application/json");
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

// --- 4. VALIDATE SKILL ---
exports.validateSkillWithAI = onCall({ region: "us-central1" }, async (request) => {
    const { skill } = request.data;
    if (!skill) throw new HttpsError('invalid-argument', 'Missing skill.');

    const prompt = `
        Evaluate skill: "${skill.name}" (Rating: ${skill.rating}).
        Proof: "${skill.proof || 'None'}". Certs: ${JSON.stringify(skill.certifications)}.
        Respond with ONLY: "Strongly Supported", "Supported", or "Not Supported".
    `;
    try {
        const result = await callGemini(prompt, null, null, [], "text/plain");
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

// --- 5. GENERATE SUMMARY ---
exports.generateSummaryWithAI = onCall({ region: "us-central1" }, async (request) => {
    const { allProofPoints } = request.data;
    if (typeof allProofPoints !== 'string') throw new HttpsError('invalid-argument', 'Missing proof points.');
    
    const prompt = `Write a 100-150 word professional summary based on:\n\n${allProofPoints}`;
    try {
        const result = await callGemini(prompt, null, null, [], "text/plain");
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});