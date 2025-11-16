import React, { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts';

// This is a local helper component now, as its content is part of a larger section.
const RatingLegendContent = () => {
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };
    return (
        <div>
            <h4 className="font-bold mb-2 text-center">Rating Legend</h4>
            <ul className="space-y-1">
                {Object.entries(ratingLabels).map(([level, description]) => (<li key={level}><span className="font-semibold">{level}:</span> {description}</li>))}
            </ul>
        </div>
    );
};

export default function ReportScreen({ user, setView, profileForReport, db, appId }) {
    const [profile, setProfile] = useState(null);
    const [employmentHistory, setEmploymentHistory] = useState([]);
    const [accreditations, setAccreditations] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchAllData = async () => {
            if (!user || !user.uid) { setLoading(false); return; }
            const userDocRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) setProfile(userDoc.data());

            const historySnapshot = await userDocRef.collection('employmentHistory').orderBy('order').get();
            setEmploymentHistory(historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            const accreditationSnapshot = await userDocRef.collection('accreditations').orderBy('order').get();
            setAccreditations(accreditationSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            setLoading(false);
        };
        fetchAllData();
    }, [user, db, appId]);

    if (loading) { return <div className="text-center p-10">Generating Report...</div>; }
    
    if(!profile || !profileForReport) {
        return (
            <div className="text-center p-10">
                <p>Could not load report data.</p>
                <button onClick={() => setView('dashboard')} className="mt-4 bg-gray-500 text-white px-4 py-2 rounded-md">&larr; Back to Dashboard</button>
            </div>
        );
    }
    
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };

    const reportChartData = profileForReport.skills.map((skill) => ({
        subject: skill.name,
        user: skill.rating,
        entry: 2,
        qualified: 3,
        expert: 4,
        fullMark: 4,
    }));

    return (
        <div>
            <div className="flex justify-between items-center mb-6 print:hidden">
                <button onClick={() => setView('dashboard')} className="bg-gray-500 text-white px-4 py-2 rounded-md">Back to Dashboard</button>
                <button onClick={() => window.print()} className="bg-blue-500 text-white px-6 py-2 rounded-md">Print Report</button>
            </div>

            <div className="bg-white p-8 shadow-lg" id="report-content">
                 <div className="report-page portrait-page">
                     <div className="report-header">
                         <svg width="120" height="50" viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" className="h-12">
                            <g fill="none" stroke="#4A5568" strokeWidth="4">
                                <path d="M20 35 L20 15 L35 35 L35 15" />
                            </g>
                            <text x="45" y="30" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="bold" fill="#4A5568">Netsume</text>
                        </svg>
                     </div>
                     <h1 className="text-3xl font-bold text-center mb-8">Competence Assessment Report for {profile.name}</h1>
                     
                     <h2 className="text-2xl font-semibold border-b-2 border-gray-300 pb-2 mb-4">User Profile</h2>
                     {profile && (
                         <div className="grid grid-cols-2 gap-4 mb-8">
                             <div><span className="font-semibold">Name:</span> {profile.name}</div>
                             <div><span className="font-semibold">City, Country:</span> {profile.city}</div>
                             <div><span className="font-semibold">Current Employer:</span> {profile.currentEmployer}</div>
                             <div><span className="font-semibold">Current Job Title:</span> {profile.currentJobTitle}</div>
                              {profile.linkedin && <div><span className="font-semibold">LinkedIn:</span> <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500">{profile.linkedin}</a></div>}
                         </div>
                     )}
                     
                     <h2 className="text-2xl font-semibold border-b-2 border-gray-300 pb-2 mb-4">About this App</h2>
                     <div className="p-4 border-dashed border-2 border-gray-300 text-gray-700 mb-8 text-sm">
                         <p>This tool provides a 3-dimensional assessment of skills and competence for performance management and recruitment. It is based on 1) The candidate's own assessment with proof points on each skill; 2) An AI-assisted appraisal on whether the claim of the skill level is well supported; 3) How the skill profile meets the requirements for hiring or promotion.</p>
                         <p className="mt-4">Netsume is a trademark of Insightful Innovative Services, Inc., www.insightfulis.com</p>
                     </div>

                     <h2 className="text-2xl font-semibold border-b-2 border-gray-300 pb-2 mb-4">About {profile.name}</h2>
                     <div className="p-4 border-dashed border-2 border-gray-300 text-gray-700 mb-8 text-sm">
                         {profileForReport.summary || 'No summary provided.'}
                     </div>

                     <h2 className="text-2xl font-bold mb-4">Employment History</h2>
                     <div className="space-y-4 mb-8">
                         {employmentHistory.map(job => (
                             <div key={job.id}>
                                 <p className="font-bold">{job.jobTitle} at {job.company}</p>
                                 <p className="text-sm text-gray-600">{job.startDate} - {job.endDate || 'Present'} | {job.city}</p>
                                 <p className="mt-1 text-sm">{job.description}</p>
                             </div>
                         ))}
                     </div>

                     <h2 className="text-2xl font-semibold border-b-2 border-gray-300 pb-2 mb-4">Diploma/Degree/Accreditation</h2>
                     <div className="space-y-4">
                         {accreditations.map(acc => (
                             <div key={acc.id}>
                                 <p className="font-bold">{acc.name}</p>
                                 <p className="text-sm text-gray-600">{acc.institute}, {acc.location} - {acc.year}</p>
                             </div>
                         ))}
                     </div>
                 </div>

                 {profileForReport && (
                     <div key={profileForReport.id} className="report-page landscape-page">
                          <div className="report-header">
                             <svg width="120" height="50" viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" className="h-12">
                                <g fill="none" stroke="#4A5568" strokeWidth="4">
                                    <path d="M20 35 L20 15 L35 35 L35 15" />
                                </g>
                                <text x="45" y="30" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="bold" fill="#4A5568">Netsume</text>
                            </svg>
                          </div>
                         <h1 className="text-3xl font-bold text-center mb-2">{profileForReport.jobTitle}</h1>
                         <h2 className="text-xl text-gray-600 text-center mb-8">Skill Profile for {profile.name}</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                             <div>
                                 <ResponsiveContainer width="100%" height={300}>
                                     <RadarChart cx="50%" cy="50%" outerRadius="80%" data={reportChartData}>
                                         <PolarGrid />
                                         <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                         <PolarRadiusAxis angle={30} domain={[0, 4]} tickCount={5} />
                                         <Radar name="Self-Assessment" dataKey="user" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                         <Radar name="Qualified Level" dataKey="entry" stroke="#A52A2A" fill="#A52A2A" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                                         <Radar name="Mentor Level" dataKey="qualified" stroke="#228B22" fill="#228B22" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                                         <Radar name="Expert Level" dataKey="expert" stroke="#C700C7" fill="#C700C7" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                                         <Legend />
                                     </RadarChart>
                                 </ResponsiveContainer>
                                 
                                 <div className="mt-4 p-3 border rounded-lg bg-gray-50">
                                     <h3 className="text-center font-bold text-base mb-2 border-b pb-1">Explanations & Definitions</h3>
                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="text-xs text-gray-700 space-y-1">
                                             <div>
                                                 <p className="font-semibold">Qualified Level:</p>
                                                 <p className="pl-2">having applied all skills at work</p>
                                             </div>
                                             <div>
                                                 <p className="font-semibold">Mentor Level:</p>
                                                 <p className="pl-2">having mastered all skills to be able to coach others</p>
                                             </div>
                                             <div>
                                                 <p className="font-semibold">Expert Level:</p>
                                                 <p className="pl-2">Thought leaders, published paper and patterns</p>
                                             </div>
                                         </div>
                                         <div className="text-xs text-gray-700">
                                              <RatingLegendContent />
                                         </div>
                                     </div>
                                 </div>

                             </div>
                              <div>
                                 <p className="text-sm text-gray-800 mb-4">
                                     The following skills are self assessed by the Candidate and <strong className="font-bold">VALIDATED by AI</strong> based on proof points supplied for NOT SUPPORTED, SUPPORTED or STRONGLY SUPPORTED.
                                 </p>
                                 <div className="space-y-4">
                                     {profileForReport.skills.map((skill, index) => (
                                         <div key={index} className="pb-2 border-b">
                                             <h4 className="font-bold">{skill.name}</h4>
                                             <p className="text-sm">Rating: {ratingLabels[skill.rating]} ({skill.supportLevel})</p>
                                             {skill.proof && <p className="text-xs mt-1"><strong>Proof:</strong> {skill.proof}</p>}
                                             {skill.certifications && skill.certifications.length > 0 && (
                                                 <div className="mt-1">
                                                     <strong className="text-xs">Certifications:</strong>
                                                     <ul className="list-disc list-inside text-xs">
                                                         {skill.certifications.map((cert, cIndex) => (
                                                             <li key={cIndex}>{cert.courseName} - {cert.institution}</li>
                                                         ))}
                                                     </ul>
                                                 </div>
                                             )}
                                         </div>
                                     ))}
                                 </div>
                              </div>
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

