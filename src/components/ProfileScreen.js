import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';
import 'firebase/compat/functions';

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

export default function ProfileScreen({ user, setUser, setView, db, appId }) {
    const [profile, setProfile] = useState({ name: '', sex: '', city: '', currentEmployer: '', currentJobTitle: '', yearsOfEmployment: '', linkedin: 'https://www.linkedin.com', resumeUrl: '' });
    const [employmentHistory, setEmploymentHistory] = useState([]);
    const [accreditations, setAccreditations] = useState([]);
    const [isEditingJob, setIsEditingJob] = useState(false);
    const [currentJob, setCurrentJob] = useState({ id: null, company: '', jobTitle: '', startDate: '', endDate: '', city: '', description: '' });
    const [isEditingAccreditation, setIsEditingAccreditation] = useState(false);
    const [currentAccreditation, setCurrentAccreditation] = useState({ id: null, name: '', institute: '', location: '', year: '' });
    const [modalMessage, setModalMessage] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isExtracting, setIsExtracting] = useState(false);
    
    const dragItem = useRef();
    const dragOverItem = useRef();

    useEffect(() => {
        const userDocRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid);
        
        const fetchProfile = async () => {
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                setProfile(prev => ({ ...prev, ...userDoc.data() }));
            }
        };
        fetchProfile();

        const historyQuery = userDocRef.collection('employmentHistory').orderBy("order");
        const historyUnsubscribe = historyQuery.onSnapshot((snapshot) => {
            setEmploymentHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const accreditationQuery = userDocRef.collection('accreditations').orderBy("order");
        const accreditationUnsubscribe = accreditationQuery.onSnapshot((snapshot) => {
            setAccreditations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            historyUnsubscribe();
            accreditationUnsubscribe();
        };
    }, [user.uid, db, appId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };
    
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setResumeFile(e.target.files[0]);
        }
    };


    // --- HANDLER: Extract Jobs (Uses V2 Function) ---

    const handleExtractFromResume = async () => {
        if (!resumeFile) { setModalMessage("Please select a resume file first."); return; }
        setIsExtracting(true);

        const reader = new FileReader();
        reader.readAsDataURL(resumeFile);
        reader.onloadend = async () => {
            const base64String = reader.result.split(',')[1];
            try {

                const extractResumeData = firebase.functions().httpsCallable('extractResumeDataV2');
                const result = await extractResumeData({ fileData: base64String, mimeType: resumeFile.type });
                
                const jsonString = result.data.replace(/```json/g, "").replace(/```/g, "").trim();

                const extractedJobs = JSON.parse(jsonString);

                if (!Array.isArray(extractedJobs)) { throw new Error("AI returned job data in an invalid format. Expecting an array."); }

                const newHistory = extractedJobs.map((job, index) => ({
                    ...job,
                    id: `new-${Date.now()}-${index}`, 
                    order: employmentHistory.length + index
                }));

                setEmploymentHistory(prev => [...prev, ...newHistory]);
                setModalMessage(`Successfully extracted ${newHistory.length} job position(s).`);
            } catch (error) {
                console.error("Error extracting from resume:", error);
                setModalMessage(`Failed to extract jobs: ${error.message}`);
            } finally { setIsExtracting(false); }
        };
    };

    // --- HANDLER: Extract Education (Uses V2 Function) ---
    const handleExtractEducation = async () => {
        if (!resumeFile) { setModalMessage("Please select a resume file first."); return; }
        setIsExtracting(true);

        const reader = new FileReader();
        reader.readAsDataURL(resumeFile);
        reader.onloadend = async () => {
            const base64String = reader.result.split(',')[1];
            try {
                const extractEducationFn = firebase.functions().httpsCallable('extractEducationDataV2'); 
                const result = await extractEducationFn({ fileData: base64String, mimeType: resumeFile.type });
                
                const jsonString = result.data.replace(/```json/g, "").replace(/```/g, "").trim();
                const extractedEducation = JSON.parse(jsonString);

                if (!Array.isArray(extractedEducation)) { throw new Error("AI returned education data in an invalid format. Expecting an array."); }

                const newAccreditations = extractedEducation.map((item, index) => ({
                    ...item,
                    id: `new-edu-${Date.now()}-${index}`, 
                    order: accreditations.length + index
                }));

                setAccreditations(prev => [...prev, ...newAccreditations]);
                setModalMessage(`Successfully extracted ${newAccreditations.length} education/certification items.`);
            } catch (error) {
                console.error("Error extracting education:", error);
                setModalMessage(`Failed to extract education: ${error.message}`);
            } finally { setIsExtracting(false); }
        };
    };

    // --- HANDLER: Extract Education ---
    const handleExtractEducation = async () => {
        if (!resumeFile) {
            setModalMessage("Please select a resume file first.");
            return;
        }

        setIsExtracting(true);

        const reader = new FileReader();
        reader.readAsDataURL(resumeFile);
        reader.onloadend = async () => {
            const base64String = reader.result.split(',')[1];
//            
            try {
                const extractEducationFn = firebase.functions().httpsCallable('extractEducationDataV2');
                const result = await extractEducationFn({ fileData: base64String, mimeType: resumeFile.type });
                
                // --- FIX: Add robust check for result data ---
                if (!result.data) {
                    throw new Error("Server returned an empty response. Check backend logs.");
                }

                const jsonString = result.data;
                const extractedEducation = JSON.parse(jsonString);

                // --- FIX: Add check to ensure JSON is an array before mapping ---
                if (!Array.isArray(extractedEducation)) {
                    throw new Error("AI returned data in an unexpected format. Expecting an array.");
                }
                
                const newAccreditations = extractedEducation.map((item, index) => ({
                    ...item,
                    id: `new-edu-${Date.now()}-${index}`, // Temporary ID
                    order: accreditations.length + index
                }));

                setAccreditations(prev => [...prev, ...newAccreditations]);
                setModalMessage(`Successfully extracted ${newAccreditations.length} education/certification items.`);
            } catch (error) {
// ... rest of the function remains the same

                console.error("Error extracting education:", error);
                setModalMessage(`Failed to extract education: ${error.message}`);
            } finally {
                setIsExtracting(false);
            }
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let finalProfileData = { ...profile };

        if (resumeFile) {
            const storageRef = firebase.storage().ref(`resumes/${user.uid}/${resumeFile.name}`);
            const uploadTask = storageRef.put(resumeFile);

            uploadTask.on('state_changed', 


                (snapshot) => { setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)); }, 
                (error) => { console.error("Upload failed:", error); setModalMessage(`Resume upload failed: ${error.message}`); }, 
                async () => { const downloadURL = await storageRef.getDownloadURL(); finalProfileData.resumeUrl = downloadURL; await saveProfile(finalProfileData); }

            );
        } else { await saveProfile(finalProfileData); }
    };

    // --- ROBUST SAVE FUNCTION ---
    const saveProfile = async (dataToSave) => {
        console.log("Attempting to save profile...");
        
        try {
            await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).set(dataToSave, { merge: true });


            const batch = db.batch();
            
            // Save Jobs
            const historyCollection = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('employmentHistory');
            employmentHistory.forEach(job => {

                if (job.id && (job.id.toString().startsWith('new-') || job.id.toString().startsWith('temp-'))) { const { id, ...jobData } = job; batch.set(historyCollection.doc(), jobData); }
                else if (job.id) { const { id, ...jobData } = job; batch.set(historyCollection.doc(id), jobData, { merge: true }); }
            });


            // Save Accreditations
            const accCollection = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('accreditations');
            accreditations.forEach(acc => {
                if (acc.id && (acc.id.toString().startsWith('new-') || acc.id.toString().startsWith('new-edu-'))) { const { id, ...accData } = acc; batch.set(accCollection.doc(), accData); }
                else if (acc.id) { const { id, ...accData } = acc; batch.set(accCollection.doc(id), accData, { merge: true }); }
            });

            await batch.commit();
            setUser(prev => ({ ...prev, ...dataToSave }));
            setModalMessage('Profile details saved successfully!');


            setTimeout(() => { setView('dashboard'); }, 1500);
        } catch (err) { console.error("Save Error:", err); setModalMessage(`Failed to save: ${err.message}`); }

    };

    const handleJobChange = (e) => { const { name, value } = e.target; setCurrentJob(prev => ({ ...prev, [name]: value })); };
    const handleJobSubmit = async (e) => { e.preventDefault(); const { id, ...jobData } = currentJob; if (!jobData.company || !jobData.jobTitle || !jobData.startDate) { setModalMessage("Please fill in Company, Job Title, and Start Date."); return; } const historyCollection = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('employmentHistory'); if (isEditingJob) { await historyCollection.doc(id).update(jobData); } else { jobData.order = employmentHistory.length; await historyCollection.add(jobData); } setCurrentJob({ id: null, company: '', jobTitle: '', startDate: '', endDate: '', city: '', description: '' }); setIsEditingJob(false); };
    const handleAccreditationChange = (e) => { const { name, value } = e.target; setCurrentAccreditation(prev => ({ ...prev, [name]: value })); };
    const handleAccreditationSubmit = async (e) => { e.preventDefault(); const { id, ...accData } = currentAccreditation; if (!accData.name || !accData.institute || !accData.year) { setModalMessage("Please fill in all accreditation fields."); return; } const accCollection = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('accreditations'); if (isEditingAccreditation) { await accCollection.doc(id).update(accData); } else { accData.order = accreditations.length; await accCollection.add(accData); } setCurrentAccreditation({ id: null, name: '', institute: '', location: '', year: '' }); setIsEditingAccreditation(false); };

    const handleDragEnd = async (list, collectionName) => { const batch = db.batch(); const collectionRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection(collectionName); list.forEach((item, index) => { const docRef = collectionRef.doc(item.id); batch.update(docRef, { order: index }); }); await batch.commit(); dragItem.current = null; dragOverItem.current = null; };
    const createDragHandlers = (list, setList, collectionName) => ({ onDragStart: (e, position) => { dragItem.current = position; }, onDragEnter: (e, position) => { dragOverItem.current = position; }, onDragEnd: () => { if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return; const newList = [...list]; const draggedItemContent = newList.splice(dragItem.current, 1)[0]; newList.splice(dragOverItem.current, 0, draggedItemContent); dragItem.current = null; dragOverItem.current = null; setList(newList); handleDragEnd(newList, collectionName); }, });
    const jobDragHandlers = createDragHandlers(employmentHistory, setEmploymentHistory, 'employmentHistory');
    const accreditationDragHandlers = createDragHandlers(accreditations, setAccreditations, 'accreditations');

    const handleEditJob = (job) => { setIsEditingJob(true); setCurrentJob(job); };
    const handleDeleteJob = async (jobId) => { await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('employmentHistory').doc(jobId).delete(); };
    const cancelEdit = () => { setIsEditingJob(false); setCurrentJob({ id: null, company: '', jobTitle: '', startDate: '', endDate: '', city: '', description: '' }); };
    
    const handleEditAccreditation = (acc) => { setIsEditingAccreditation(true); setCurrentAccreditation(acc); };
    const handleDeleteAccreditation = async (accId) => { await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('accreditations').doc(accId).delete(); };
    const cancelEditAccreditation = () => { setIsEditingAccreditation(false); setCurrentAccreditation({ id: null, name: '', institute: '', location: '', year: '' }); };

    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            {modalMessage && <Modal message={modalMessage} onClose={() => setModalMessage('')} />}
            <button onClick={() => setView('dashboard')} className="mb-6 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">&larr; Back to Dashboard</button>
            <h2 className="text-3xl font-bold mb-6">Your Profile</h2>
            

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6 mb-6">
                <div><label className="block text-gray-700 mb-2">Full Name</label><input type="text" name="name" value={profile.name || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required /></div>
                <div><label className="block text-gray-700 mb-2">Sex</label><select name="sex" value={profile.sex || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select></div>
                <div><label className="block text-gray-700 mb-2">City, Country</label><input type="text" name="city" value={profile.city || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required /></div>
                <div><label className="block text-gray-700 mb-2">Current Employer</label><input type="text" name="currentEmployer" value={profile.currentEmployer || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required /></div>
                <div><label className="block text-gray-700 mb-2">Current Job Title</label><input type="text" name="currentJobTitle" value={profile.currentJobTitle || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required /></div>
                <div><label className="block text-gray-700 mb-2">Years of Full-Time Employment</label><input type="number" name="yearsOfEmployment" value={profile.yearsOfEmployment || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md" required /></div>

                
                <div className="md:col-span-2">
                    <label className="block text-gray-700 mb-2">My LinkedIn Profile or Resume</label>
                    <input type="url" name="linkedin" value={profile.linkedin || ''} onChange={handleChange} className="w-full px-4 py-2 border rounded-md mb-2" placeholder="https://www.linkedin.com/in/your-profile" />

                <div className="flex items-center space-x-4">
                        <input type="file" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />

                        {resumeFile && <button type="button" onClick={handleExtractFromResume} disabled={isExtracting} className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 disabled:bg-purple-300">{isExtracting ? 'Extracting...' : 'Extract Jobs'}</button>}
                        {resumeFile && <button type="button" onClick={handleExtractEducation} disabled={isExtracting} className="bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 disabled:bg-indigo-300">{isExtracting ? 'Extracting...' : 'Extract Education'}</button>}
                    </div>
                    {uploadProgress > 0 && <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2"><div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${uploadProgress}%`}}></div></div>}

                    {profile.resumeUrl && !resumeFile && <p className="text-sm text-gray-600 mt-2">Current Resume: <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Uploaded File</a></p>}
                </div>

                <div className="md:col-span-2">
                    <button type="button" onClick={handleSubmit} className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors">Save Profile Details</button>
                </div>
            </form>
            
             <div className="mb-8">
                 <h3 className="text-2xl font-bold mb-4">Employment History</h3>
                 <div className="space-y-4 mb-6">
                     {employmentHistory.map((job, index) => (
                         <div key={job.id} draggable onDragStart={(e) => jobDragHandlers.onDragStart(e, index)} onDragEnter={(e) => jobDragHandlers.onDragEnter(e, index)} onDragEnd={jobDragHandlers.onDragEnd} onDragOver={(e) => e.preventDefault()} className="p-4 border rounded-md bg-gray-50 cursor-move">
                             <div className="flex justify-between items-start">
                                 <div><p className="font-bold text-lg">{job.jobTitle}</p><p className="text-md text-gray-700">{job.company}</p><p className="text-sm text-gray-500">{job.startDate} - {job.endDate || 'Present'} | {job.city}</p><p className="mt-2 text-sm whitespace-pre-wrap">{job.description}</p></div>
                                 <div className="flex space-x-2"><button onClick={() => handleEditJob(job)} className="text-sm text-blue-500 hover:underline">Edit</button><button onClick={() => handleDeleteJob(job.id)} className="text-sm text-red-500 hover:underline">Delete</button></div>
                             </div>
                         </div>
                     ))}
                 </div>
                 <div className="p-4 border rounded-md">
                     <h4 className="text-xl font-semibold mb-4">{isEditingJob ? 'Edit Position' : 'Add New Position'}</h4>
                     <form onSubmit={handleJobSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <input type="text" name="company" value={currentJob.company || ''} onChange={handleJobChange} placeholder="Company" className="w-full px-4 py-2 border rounded-md" />
                         <input type="text" name="jobTitle" value={currentJob.jobTitle || ''} onChange={handleJobChange} placeholder="Job Title" className="w-full px-4 py-2 border rounded-md" />
                         <input type="text" name="startDate" value={currentJob.startDate || ''} onChange={handleJobChange} placeholder="Start Date (e.g., Jan 2020)" className="w-full px-4 py-2 border rounded-md" />
                         <input type="text" name="endDate" value={currentJob.endDate || ''} onChange={handleJobChange} placeholder="End Date (or leave blank)" className="w-full px-4 py-2 border rounded-md" />
                         <input type="text" name="city" value={currentJob.city || ''} onChange={handleJobChange} placeholder="City/Country" className="md:col-span-2 w-full px-4 py-2 border rounded-md" />
                         <textarea name="description" value={currentJob.description || ''} onChange={handleJobChange} placeholder="Description / Responsibilities" rows="3" className="md:col-span-2 w-full px-4 py-2 border rounded-md"></textarea>
                         <div className="md:col-span-2 flex space-x-4">
                             <button type="submit" className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600">{isEditingJob ? 'Update' : 'Add'}</button>
                             {isEditingJob && <button type="button" onClick={cancelEdit} className="bg-gray-300 py-2 px-6 rounded-md hover:bg-gray-400">Cancel</button>}
                         </div>
                     </form>
                 </div>
             </div>
            <div>
                <h3 className="text-2xl font-bold mb-4">Diploma/Degree/Accreditation</h3>
                <div className="space-y-4 mb-6">
                    {accreditations.map((acc, index) => (
                        <div key={acc.id} draggable onDragStart={(e) => accreditationDragHandlers.onDragStart(e, index)} onDragEnter={(e) => accreditationDragHandlers.onDragEnter(e, index)} onDragEnd={accreditationDragHandlers.onDragEnd} onDragOver={(e) => e.preventDefault()} className="p-4 border rounded-md bg-gray-50 cursor-move">
                            <div className="flex justify-between items-start">
                                <div><p className="font-bold text-lg">{acc.name}</p><p className="text-md text-gray-700">{acc.institute}</p><p className="text-sm text-gray-500">{acc.location} - {acc.year}</p></div>
                                <div className="flex space-x-2"><button onClick={() => handleEditAccreditation(acc)} className="text-sm text-blue-500 hover:underline">Edit</button><button onClick={() => handleDeleteAccreditation(acc.id)} className="text-sm text-red-500 hover:underline">Delete</button></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border rounded-md">
                    <h4 className="text-xl font-semibold mb-4">{isEditingAccreditation ? 'Edit Accreditation' : 'Add New Accreditation'}</h4>
                    <form onSubmit={handleAccreditationSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="name" value={currentAccreditation.name || ''} onChange={handleAccreditationChange} placeholder="Certificate/Diploma and Specialization" className="w-full px-4 py-2 border rounded-md" />
                        <input type="text" name="institute" value={currentAccreditation.institute || ''} onChange={handleAccreditationChange} placeholder="Issuing Institute" className="w-full px-4 py-2 border rounded-md" />
                        <input type="text" name="location" value={currentAccreditation.location || ''} onChange={handleAccreditationChange} placeholder="City/Country" className="w-full px-4 py-2 border rounded-md" />
                        <input type="text" name="year" value={currentAccreditation.year || ''} onChange={handleAccreditationChange} placeholder="Year Obtained" className="w-full px-4 py-2 border rounded-md" />
                        <div className="md:col-span-2 flex space-x-4">
                            <button type="submit" className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600">{isEditingAccreditation ? 'Update' : 'Add'}</button>
                            {isEditingAccreditation && <button type="button" onClick={cancelEditAccreditation} className="bg-gray-300 py-2 px-6 rounded-md hover:bg-gray-400">Cancel</button>}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}