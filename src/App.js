import React, { useState, useEffect } from 'react';
// You will need to re-import your components
import AuthScreen from './components/AuthScreen';
import ProfileScreen from './components/ProfileScreen';
import Dashboard from './components/Dashboard';
import ReportScreen from './components/ReportScreen';
import AdminScreen from './components/AdminScreen'; 

// --- v8 COMPAT IMPORTS ---
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';

// --- YOUR CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDMd9-Q5t4vjcU2UGpqLbD7MOtXY7fRWwM",
    authDomain: "bkanetsume4.firebaseapp.com",
    projectId: "bkanetsume4",
    storageBucket: "bkanetsume4.firebasestorage.app",
    messagingSenderId: "80370007495",
    appId: "1:80370007495:web:18d01fecfe76206632ede2",
    measurementId: "G-S94260E2BC"
};

// --- ADMIN Configuration ---
const ADMIN_UIDS = ["UOisb5Gh7FRVf0LmGantbQS2Lo33"];

// --- SIMPLIFIED INITIALIZATION (THE FIX) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- Get services from the ONE (default) app ---
const auth = firebase.auth(); 
const db = firebase.firestore(); // <-- This fixes the connection
const functions = firebase.functions(); // Added this back

// We use a simple, clean path.
const appId = "bkanetsume4"; 
// --- END OF FIX ---


export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('loading');
    const [profileForReport, setProfileForReport] = useState(null);
    const [globalError, setGlobalError] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    // This is the effect that is failing at line 108
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            try {
                setGlobalError('');
                if (currentUser) {
                    if (ADMIN_UIDS.includes(currentUser.uid)) {
                        setIsAdmin(true);
                    } else {
                        setIsAdmin(false);
                    }

                    // --- THIS LINE WILL NOW SUCCEED ---
                    // It uses the correct 'db' and 'appId'
                    const userDocRef = db.collection('artifacts').doc(appId).collection('users').doc(currentUser.uid);
                    const userDoc = await userDocRef.get();
                    
                    if (userDoc.exists && userDoc.data().name) {
                        setUser({ uid: currentUser.uid, ...userDoc.data(), email: currentUser.email });
                        setView('dashboard');
                    } else {
                        setUser({ uid: currentUser.uid, email: currentUser.email });
                        setView('profile');
                    }
                } else {
                    setUser(null);
                    setIsAdmin(false);
                    setView('auth');
                }
            } catch (err) {
                // This is the error you are seeing
                console.error("Auth state change error:", err); 
                setGlobalError("Could not connect to the database. This might be a permissions issue.");
            } finally {
                setLoading(false);
            }
        });
        
        return () => unsubscribe();
    }, []); // This runs when auth state changes

    const handleSignOut = async () => {
        await auth.signOut();
        setUser(null);
        setView('auth');
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="text-xl font-semibold">Initializing Application...</div></div>;
    }

    const renderView = () => {
        switch(view) {
            case 'auth':
                return <AuthScreen auth={auth} />;
            case 'profile':
                return <ProfileScreen user={user} setUser={setUser} setView={setView} db={db} appId={appId} />;
            case 'dashboard':
                return <Dashboard user={user} setView={setView} setProfileForReport={setProfileForReport} db={db} appId={appId} />;
            case 'report':
                 return <ReportScreen user={user} setView={setView} profileForReport={profileForReport} db={db} appId={appId} />;
            case 'admin':
                return <AdminScreen db={db} appId={appId} />;
            default:
                return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="text-xl font-semibold">Loading...</div></div>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {globalError && (
                <div className="bg-red-100 border-b-2 border-red-500 text-red-800 text-center p-4" role="alert">
                    <p><span className="font-bold">Error:</span> {globalError}</p>
                </div>
            )}
            <header className="bg-white shadow-md print:hidden">
                <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">Get Hired based on your SKILLS</h1>
                    {user && (
                        <div className="flex items-center space-x-2 md:space-x-4">
                           {isAdmin && <button onClick={() => setView('admin')} className="text-green-600 font-bold hover:underline">Admin</button>}
                            <span className="text-gray-700 hidden sm:inline">Welcome, {user.name || 'User'}</span>
                            <button onClick={() => setView('profile')} className="text-blue-500 hover:underline">My Profile</button>
                            <button onClick={handleSignOut} className="bg-red-500 text-white px-3 py-2 text-sm md:px-4 rounded-md hover:bg-red-600">Sign Out</button>
                        </div>
                    )}
                </nav>
            </header>
            <main className="container mx-auto p-4 md:p-6">
                {renderView()}
            </main>
        </div>
    );
}