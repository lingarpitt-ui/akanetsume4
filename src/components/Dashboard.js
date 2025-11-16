import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/functions';
import SkillAssessment from './SkillAssessment';

// --- Modal Component ---
const Modal = ({ message, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full mx-4">
            {typeof message === 'string' ? <p className="mb-4 text-gray-800">{message}</p> : null}
            {typeof message === 'object' && message.text && <p className="mb-4 text-gray-800">{message.text}</p>}
            {children}
            <button
                onClick={onClose}
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors mt-4 w-full"
            >
                Close
            </button>
        </div>
    </div>
);

// --- Dashboard Component ---
export default function Dashboard({ user, setView, setProfileForReport, db, appId }) {
    const [profiles, setProfiles] = useState([]);
    const [newProfileTitle, setNewProfileTitle] = useState('');
    const [loadingSkills, setLoadingSkills] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        const q = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('skillProfiles');
        const unsubscribe = q.onSnapshot((querySnapshot) => {
            const profilesData = [];
            querySnapshot.forEach((doc) => {
                profilesData.push({ id: doc.id, ...doc.data() });
            });
            setProfiles(profilesData);
        });
        return () => unsubscribe();
    }, [user.uid, db, appId]);

    // This is your complete, fixed function.
    const handleCreateProfile = async (e) => {
        e.preventDefault();
        
        // Safety check for newProfileTitle
        if (!newProfileTitle || newProfileTitle.trim() === "") {
            console.error("Cannot generate skills: newProfileTitle is empty.");
            setModalMessage("Please enter a job title to generate skills.");
            return; // Stop the function here
        }

        setLoadingSkills(true);

        try {
            // Define and call the Cloud Function
            const generateSkills = firebase.functions().httpsCallable('generateSkills');
            const result = await generateSkills({ jobTitle: newProfileTitle });
            const text = result.data;

            const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const skillNames = JSON.parse(jsonString);

            const newSkills = skillNames.map(name => ({ name, rating: 0, proof: '', certifications: [], supportLevel: 'Not Validated' }));
            
            const newProfileData = {
                jobTitle: newProfileTitle,
                skills: newSkills,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('skillProfiles').add(newProfileData);
            setSelectedProfile({ id: docRef.id, ...newProfileData });
            setNewProfileTitle('');

        } catch (error) {
            console.error("Error generating skills:", error);
            setModalMessage(`Failed to generate skills: ${error.message}`);
        } finally {
            setLoadingSkills(false);
        }
    };
    
    const handleGenerateReport = (profile) => {
        setProfileForReport(profile);
        setView('report');
    };

    const handleDeleteProfile = (profileId) => {
        setModalMessage({
            text: "Are you sure you want to delete this skill profile?",
            onConfirm: async () => {
                await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('skillProfiles').doc(profileId).delete();
                setModalMessage('');
            }
        });
    };

    if (selectedProfile) {
        return <SkillAssessment profile={selectedProfile} user={user} onBack={() => setSelectedProfile(null)} db={db} appId={appId} />;
    }

    return (
        <div>
             <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Netsume - Redefining Recruitment & Promotion</h1>
             <div className="text-center text-gray-600 mb-8 space-y-1">
                <p className="text-lg">Put your BEST Skills forward</p>
                <p className="text-lg">Use AI (the VALIDATION button) to improve your <span className="font-bold">EXPERIENCE</span> write-up</p>
                <p className="text-lg">Generate a <span className="font-bold">High Impact RESUME</span></p>
             </div>
            {modalMessage && (
                <Modal message={modalMessage} onClose={() => setModalMessage('')}>
                    {modalMessage.onConfirm && (
                        <button
                            onClick={modalMessage.onConfirm}
                            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors mt-2 w-full"
                        >
                            Confirm Delete
                        </button>
                    )}
                </Modal>
            )}
            <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                <h2 className="text-2xl font-bold mb-4">Target Job Position and Industry</h2>
                <form onSubmit={handleCreateProfile} className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <input type="text" value={newProfileTitle} onChange={(e) => setNewProfileTitle(e.target.value)} placeholder="e.g. Software Engineer, Accountant in Retail" className="flex-grow w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={loadingSkills} />
                    <button type="submit" className="w-full sm:w-auto bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300" disabled={loadingSkills}>{loadingSkills ? 'Generating...' : 'Create'}</button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                <h2 className="text-2xl font-bold mb-4">How to Use Netsume</h2>
                <ol className="list-decimal list-inside text-gray-700 space-y-2">
                    <li>Define your target Job or Position in the relevant industry</li>
                    <li>Assess your own capabilities on each skill attribute with 0 = No Knowledge; 1 = Learned; 2 = Applied at Work; 3 = Coached Others and 4 = Expert</li>
                    <li>Provide Justifications by citing SiTuations, ACTION taken and RESULTS, and accreditations</li>
                    <li>Use VALIDATE button to check if your claimed level of competence is SUPPORTED or not, and improve your writeup whenever possible.</li>
                    <li>Press GENERATE SKILL SUMMARY button to generate your competence, which you can EDIT that can be your resume.</li>
                    <li>Don't forget to SAVE ASSESSMENT before leaving the page</li>
                    <li>Your can view your results or PRINT it to a PDF file</li>
                </ol>
                <p className="text-sm text-gray-600 mt-4">
                    Netsume is a registered product of Insightful Innovative Services, Inc. Please see <a href="https://docs.google.com/document/d/1Il13tTskUj_pYZ9dqRLrSNSqOXm9ljubsPKltsuY95o/edit?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Terms of Use</a>.
                </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Your Skill Profiles</h2>
                {profiles.length > 0 ? (
                    <ul className="space-y-4">
                        {profiles.map(profile => (
                            <li key={profile.id} className="border p-4 rounded-md flex flex-col md:flex-row justify-between items-center hover:bg-gray-50 space-y-2 md:space-y-0">
                                <span className="font-semibold text-lg text-center md:text-left">{profile.jobTitle}</span>
                                <div className="flex flex-wrap justify-center space-x-2">
                                    <button onClick={() => setSelectedProfile(profile)} className="bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300">View/Edit</button>
                                    <button onClick={() => handleGenerateReport(profile)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Report</button>
                                    <button onClick={() => handleDeleteProfile(profile.id)} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>You haven't created any skill profiles yet.</p>
                )}
            </div>
        </div>
    );
}