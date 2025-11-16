import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/functions';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper Components
const Modal = ({ message, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full mx-4">
            {typeof message === 'string' ? <p className="mb-4 text-gray-800">{message}</p> : null}
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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };
    const supportLevel = data.supportLevel || 'Not Validated';

    const getSupportTextStyle = (level) => {
        switch (level) {
            case 'Strongly Supported': return 'text-green-700';
            case 'Supported': return 'text-yellow-700';
            case 'Not Supported': return 'text-red-700';
            default: return 'text-gray-500';
        }
    };

    return (
      <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg max-w-xs">
        <p className="font-bold text-gray-800">{`${label}`}</p>
        <p className="text-sm text-indigo-600 font-semibold">
            {`Rating: ${ratingLabels[data.user]}`}
            <span className={`ml-1 font-normal ${getSupportTextStyle(supportLevel)}`}>
                ({supportLevel})
            </span>
        </p>
        {data.proof && (
            <div>
                 <p className="text-sm text-gray-600 mt-2 font-semibold">Proof Points:</p>
                 <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.proof}</p>
            </div>
        )}
        {data.certifications && data.certifications.length > 0 && (
             <div>
                 <p className="text-sm text-gray-600 mt-2 font-semibold">Certifications:</p>
                 {data.certifications.map((cert, index) => (
                   <div key={index} className="mt-1 pl-2 border-l-2 border-gray-200">
                       <p className="text-sm text-gray-700 font-medium">{cert.courseName}</p>
                       <p className="text-xs text-gray-500">{cert.institution}</p>
                   </div>
                 ))}
            </div>
        )}
      </div>
    );
  }

  return null;
};

const CertificationForm = ({ certData, onSave, onCancel, onChange }) => {
    return (
        <div className="mt-4 p-4 border rounded-md bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" name="courseName" value={certData.courseName || ''} onChange={onChange} placeholder="Course/Program Name" className="w-full px-3 py-2 border rounded-md" />
                <input type="text" name="institution" value={certData.institution || ''} onChange={onChange} placeholder="Granting Institution" className="w-full px-3 py-2 border rounded-md" />
                <input type="text" name="city" value={certData.city || ''} onChange={onChange} placeholder="City/Country" className="w-full px-3 py-2 border rounded-md" />
                <input type="text" name="completionDate" value={certData.completionDate || ''} onChange={onChange} placeholder="Completion Date" className="w-full px-3 py-2 border rounded-md" />
                <input type="text" name="degree" value={certData.degree || ''} onChange={onChange} placeholder="Degree/Diploma" className="sm:col-span-2 w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="flex space-x-4 mt-4">
                <button onClick={onSave} className="bg-green-500 text-white py-1 px-4 rounded-md hover:bg-green-600">Save</button>
                <button onClick={onCancel} className="bg-gray-300 py-1 px-4 rounded-md hover:bg-gray-400">Cancel</button>
            </div>
        </div>
    );
};

const RatingLegend = () => {
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };
    return (
        <div className="mt-4 p-3 border rounded-lg bg-gray-50 text-xs text-gray-700">
            <h4 className="font-bold mb-2 text-center">Rating Legend</h4>
            <ul className="space-y-1">
                {Object.entries(ratingLabels).map(([level, description]) => (<li key={level}><span className="font-semibold">{level}:</span> {description}</li>))}
            </ul>
        </div>
    );
};

export default function SkillAssessment({ profile, user, onBack, db, appId }) {
    const [skills, setSkills] = useState(profile.skills || []);
    const [newSkillName, setNewSkillName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [editingCert, setEditingCert] = useState({ skillIndex: null, certIndex: null, data: null });
    const [validatingSkill, setValidatingSkill] = useState(null);
    const [summary, setSummary] = useState(profile.summary || '');

    const handleSkillChange = (index, field, value) => {
        const updatedSkills = [...skills];
        updatedSkills[index] = { ...updatedSkills[index], [field]: value };
        setSkills(updatedSkills);
    };

    const handleAddNewSkill = (e) => {
        e.preventDefault();
        if (!newSkillName.trim()) {
            setModalMessage('Please enter a skill name.');
            return;
        }
        const newSkill = { name: newSkillName.trim(), rating: 0, proof: '', certifications: [], supportLevel: 'Not Validated' };
        setSkills([...skills, newSkill]);
        setNewSkillName('');
    };
    
    const handleCertChange = (e) => {
        const { name, value } = e.target;
        setEditingCert(prev => ({ ...prev, data: { ...prev.data, [name]: value } }));
    };

    const openCertForm = (skillIndex, certIndex = null) => {
        if (certIndex !== null) {
            const certToEdit = skills[skillIndex].certifications[certIndex];
            setEditingCert({ skillIndex, certIndex, data: { ...certToEdit } });
        } else {
            setEditingCert({ skillIndex, certIndex: null, data: { courseName: '', institution: '', city: '', completionDate: '', degree: '' } });
        }
    };

    const handleSaveCertification = () => {
        const { skillIndex, certIndex, data } = editingCert;
        if (!data.courseName || !data.institution) {
            setModalMessage("Please provide at least a Course Name and Institution.");
            return;
        }

        const updatedSkills = [...skills];
        const targetSkill = updatedSkills[skillIndex];
        const updatedCerts = [...(targetSkill.certifications || [])];

        if (certIndex !== null) {
            updatedCerts[certIndex] = data;
        } else {
            updatedCerts.push(data);
        }
        
        targetSkill.certifications = updatedCerts;
        setSkills(updatedSkills);
        setEditingCert({ skillIndex: null, certIndex: null, data: null });
    };

    const handleDeleteCertification = (skillIndex, certIndex) => {
        const updatedSkills = [...skills];
        const targetSkill = updatedSkills[skillIndex];
        targetSkill.certifications.splice(certIndex, 1);
        setSkills(updatedSkills);
    };
    
    const validateSkill = async (skillIndex) => {
        // --- AI VALIDATION DISABLED FOR TESTING ---
        setModalMessage("AI Validation is temporarily disabled to test other features.");
        // const validateSkillWithAI = firebase.functions().httpsCallable('validateSkillWithAI');
        // try {
        //     const result = await validateSkillWithAI({ skill: skills[skillIndex] });
        //     const text = result.data.trim();
        //     handleSkillChange(skillIndex, 'supportLevel', text);
        // } catch (error) {
        //     console.error("Error validating skill:", error);
        //     setModalMessage(`Failed to get AI validation: ${error.message}.`);
        // } finally {
        //     setValidatingSkill(null);
        // }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const profileRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('skillProfiles').doc(profile.id);
            await profileRef.update({ skills, summary });
            setModalMessage('Assessment saved successfully!');
        } catch (error) {
            console.error("Error saving assessment:", error);
            setModalMessage('Failed to save assessment.');
        } finally {
            setIsSaving(false);
        }
    };

    const generateSummary = async () => {
        const allProofPoints = skills.map(s => s.proof).filter(p => p).join('\n');
        
        try {
            const generateSummaryWithAI = firebase.functions().httpsCallable('generateSummaryWithAI');
            const result = await generateSummaryWithAI({ allProofPoints });
            const text = result.data.trim();
            setSummary(text);
        } catch(err) {
            console.error("Failed to generate summary", err);
            setModalMessage(`Could not generate a summary: ${err.message}`);
        }
    };

    const chartData = skills.map((skill) => ({
        subject: skill.name,
        user: skill.rating,
        entry: 2,
        qualified: 3, 
        expert: 4,
        fullMark: 4,
        proof: skill.proof,
        certifications: skill.certifications,
        supportLevel: skill.supportLevel,
    }));
    
    const ratingLabels = { 0: "No Skill", 1: "Learned", 2: "Applied at Work", 3: "Have Mentored others", 4: "Expert Level" };
    
    const getSupportTextStyle = (level) => {
        switch (level) {
            case 'Strongly Supported': return 'text-green-700';
            case 'Supported': return 'text-yellow-700';
            case 'Not Supported': return 'text-red-700';
            default: return 'text-gray-500';
        }
    };

    return (
        <div>
            {modalMessage && <Modal message={modalMessage} onClose={() => setModalMessage('')} />}
            <button onClick={onBack} className="mb-6 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">&larr; Back to Dashboard</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Self-Assessment: {profile.jobTitle}</h2>
                    <div className="space-y-6">
                        {skills.map((skill, index) => (
                            <div key={index} className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-2">{skill.name}</h3>
                                <div className="mb-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Rating: {ratingLabels[skill.rating]}
                                        <span className={`ml-2 font-normal ${getSupportTextStyle(skill.supportLevel)}`}>
                                            ({skill.supportLevel || 'Not Validated'})
                                        </span>
                                    </label>
                                    <input type="range" min="0" max="4" value={skill.rating} onChange={(e) => handleSkillChange(index, 'rating', parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                     <div className="flex justify-between text-[10px] sm:text-xs text-gray-600 mt-1">
                                         <div className="text-center w-1/5">No Skill</div><div className="text-center w-1/5">Learned</div><div className="text-center w-1/5">Applied</div><div className="text-center w-1/5">Mentored</div><div className="text-center w-1/5">Expert</div>
                                     </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Proof Points / Examples</label>
                                    <textarea value={skill.proof} onChange={(e) => handleSkillChange(index, 'proof', e.target.value)} rows="3" className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="e.g., Led a project where I applied this skill..."></textarea>
                                </div>
                                <div className="mt-4">
                                    <h4 className="font-semibold text-gray-800">Training & Certifications</h4>
                                    {(skill.certifications || []).map((cert, certIndex) => (
                                        <div key={certIndex} className="text-sm p-2 my-1 border-l-4 border-gray-200 bg-gray-50 flex justify-between items-start">
                                            <div>
                                                <p className="font-bold">{cert.courseName} ({cert.degree || 'Certificate'})</p>
                                                <p className="text-gray-600">{cert.institution}, {cert.city} - {cert.completionDate}</p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => openCertForm(index, certIndex)} className="text-xs text-blue-500">Edit</button>
                                                <button onClick={() => handleDeleteCertification(index, certIndex)} className="text-xs text-red-500">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingCert.skillIndex === index ? (
                                         <CertificationForm certData={editingCert.data} onChange={handleCertChange} onSave={handleSaveCertification} onCancel={() => setEditingCert({ skillIndex: null, certIndex: null, data: null })} />
                                    ) : (
                                        <button onClick={() => openCertForm(index)} className="mt-2 text-sm bg-gray-200 px-3 py-1 rounded-md">+ Add Certification</button>
                                    )}
                                </div>
                                <div className="text-right mt-2">
                                    <button onClick={() => validateSkill(index)} disabled={validatingSkill === index} className="text-sm bg-indigo-500 text-white px-3 py-1 rounded-md">
                                        {validatingSkill === index ? 'Validating...' : 'Validate'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-xl font-semibold mb-4">Add Custom Skill</h3>
                        <form onSubmit={handleAddNewSkill} className="flex items-center space-x-4">
                            <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="Enter a new skill name" className="flex-grow px-4 py-2 border rounded-md" />
                            <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-md">Add</button>
                        </form>
                    </div>
                     <div className="border-t pt-6 mt-6">
                        <h3 className="text-xl font-semibold mb-4">Skill Summary</h3>
                        <button onClick={generateSummary} className="bg-purple-500 text-white px-6 py-2 rounded-md">Generate Skill Summary</button>
                        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows="5" className="w-full mt-4 p-2 border rounded-md"></textarea>
                    </div>
                    <button onClick={handleSave} disabled={isSaving} className="mt-6 w-full bg-green-500 text-white py-2 rounded-md">
                        {isSaving ? 'Saving...' : 'Save Assessment'}
                    </button>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Competence Chart</h2>
                    <ResponsiveContainer width="100%" height={350}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, width: 60, wordWrap: 'break-word' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 4]} tickCount={5} />
                            <Tooltip content={<CustomTooltip />} />
                            <Radar name="Your Assessment" dataKey="user" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                             <Radar name="Entry Level" dataKey="entry" stroke="#A52A2A" fill="#A52A2A" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                             <Radar name="Qualified Level" dataKey="qualified" stroke="#228B22" fill="#228B22" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                             <Radar name="Expert Level" dataKey="expert" stroke="#ff8042" fill="#ff8042" fillOpacity={0} strokeDasharray="3 3" strokeWidth={2} />
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                    <RatingLegend />
                </div>
            </div>
        </div>
    );
};

