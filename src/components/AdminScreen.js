import React, { useState, useEffect } from 'react';

export default function AdminScreen({ db, appId }) {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const usersSnapshot = await db.collection('artifacts').doc(appId).collection('users').get();
                const allData = [];

                for (const userDoc of usersSnapshot.docs) {
                    const userData = userDoc.data();
                    const skillProfilesSnapshot = await db.collection('artifacts').doc(appId).collection('users').doc(userDoc.id).collection('skillProfiles').get();
                    
                    if (skillProfilesSnapshot.empty) {
                        allData.push({
                            userId: userDoc.id,
                            name: userData.name || 'N/A',
                            city: userData.city || 'N/A',
                            email: userData.email || 'N/A', // Note: Email needs to be added to user profile data to appear here
                            profileTitle: 'No skill profiles created',
                            createdAt: 'N/A'
                        });
                    } else {
                        skillProfilesSnapshot.forEach(profileDoc => {
                            const profileData = profileDoc.data();
                            allData.push({
                                userId: userDoc.id,
                                name: userData.name || 'N/A',
                                city: userData.city || 'N/A',
                                email: userData.email || 'N/A',
                                profileTitle: profileData.jobTitle || 'N/A',
                                createdAt: profileData.createdAt?.toDate().toLocaleString() || 'N/A'
                            });
                        });
                    }
                }
                setReportData(allData);
            } catch (err) {
                setError('Failed to fetch report data. Check Firestore permissions.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [db, appId]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Report</h1>
            {loading && <p>Loading report data...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Profile Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.city}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.profileTitle}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.createdAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
