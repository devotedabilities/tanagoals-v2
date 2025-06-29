import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Check, X as Cross } from 'lucide-react';

// --- Firebase Configuration ---
// This configuration is automatically provided by the environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// --- App ID ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-progress-tracker';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Helper Functions & Components ---

function getEmoji(ticks, crosses) {
    if (crosses >= 28) return "🤯";
    if (crosses >= 14) return "😔";
    if (crosses >= 9) return "😳";
    if (ticks >= 28) return "🤩";
    if (ticks >= 20) return "🥳";
    if (ticks >= 14) return "😆";
    if (ticks >= 7) return "😁";
    if (ticks >= 1) return "☺️";
    return "🙂";
}

// Reusable Card component
const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-md border ${className}`}>
        {children}
    </div>
);

const CardContent = ({ children, className = '' }) => (
    <div className={`p-4 ${className}`}>
        {children}
    </div>
);

// Reusable Badge component
const Badge = ({ children, className = '' }) => (
    <span className={`inline-block px-2 py-1 text-xs font-semibold leading-none text-gray-600 bg-gray-100 rounded-full border border-gray-200 ${className}`}>
        {children}
    </span>
);


function WeekBlock({ label, rows, color, prefixes = [], trackerId, userId }) {
    const totalItems = rows * 4 * 7;
    const [states, setStates] = useState(Array(totalItems).fill('blank'));
    const docRef = userId ? doc(db, 'trackers', trackerId, 'users', userId) : null;

    // Effect to load and listen for real-time state changes from Firestore
    useEffect(() => {
        if (!docRef) return;

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const weekBlockData = data[label] || [];
                if (weekBlockData.length === totalItems) {
                    setStates(weekBlockData);
                }
            } else {
                 // If no data exists, we can initialize it here
                 // For this app, we'll let the first click create the document
                 console.log("No such document for WeekBlock, will be created on first interaction.");
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [docRef, label, totalItems]);

    // Function to handle click and update Firestore
    const handleClick = async (index) => {
        if (!docRef) {
            console.error("User not authenticated, cannot save progress.");
            return;
        }

        const newStates = [...states];
        newStates[index] = newStates[index] === "blank" ? "tick" : newStates[index] === "tick" ? "cross" : "blank";
        setStates(newStates); // Optimistic UI update

        try {
             // We use setDoc with merge: true to create or update the document
             // without overwriting other fields.
            await setDoc(docRef, { [label]: newStates }, { merge: true });
        } catch (error) {
            console.error("Error updating document: ", error);
            // Optionally revert the state if Firestore update fails
        }
    };


    return (
        <Card className="mb-6">
            <CardContent>
                <h2 className={`text-md font-semibold mb-3 text-${color}-700`}>{label}</h2>
                <div className="space-y-2">
                    {Array.from({ length: rows }).map((_, rowIndex) => {
                        const rowStartIndex = rowIndex * 28;
                        const rowEndIndex = rowStartIndex + 28;
                        const rowStates = states.slice(rowStartIndex, rowEndIndex);
                        const ticks = rowStates.filter(s => s === "tick").length;
                        const crosses = rowStates.filter(s => s === "cross").length;
                        const emoji = getEmoji(ticks, crosses);

                        return (
                            <div key={rowIndex} className="flex items-center gap-2">
                                <span className={`font-bold text-${color}-600 w-4 text-center`}>{prefixes[rowIndex] || ""}</span>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({ length: 4 }).map((_, blockIndex) => {
                                      return (
                                          <div key={blockIndex} className="flex gap-1 px-2 py-1 rounded-full bg-gray-100 shadow-sm">
                                              {Array.from({ length: 7 }).map((_, dayIndex) => {
                                                  const index = rowIndex * 28 + blockIndex * 7 + dayIndex;
                                                  const status = states[index];
                                                  const Icon = status === "tick" ? Check : status === "cross" ? Cross : null;
                                                  return (
                                                      <div
                                                          key={dayIndex}
                                                          onClick={() => handleClick(index)}
                                                          className={`w-5 h-5 border-2 rounded-full flex items-center justify-center text-[10px] cursor-pointer transition-all duration-200 ${
                                                              status === 'tick' ? `bg-${color}-500 text-white border-${color}-600` :
                                                              status === 'cross' ? `bg-white text-red-500 border-red-400` :
                                                              `bg-white text-transparent hover:bg-gray-200 border-gray-300`
                                                          }`}
                                                          title={`Week ${rowIndex * 4 + blockIndex + 1}, Day ${dayIndex + 1}`}
                                                      >
                                                          {Icon && <Icon className="w-3 h-3" />}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      );
                                  })}
                                </div>
                                <span className="ml-2 text-2xl">{emoji}</span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}


// --- Main App Component ---

export default function App() {
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // This is a unique ID for this instance of the tracker.
    // In a real app, you might get this from the URL.
    const trackerId = `tana-financial-tracker-${appId}`;

    useEffect(() => {
        // Handle user authentication state
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in.
                setUserId(user.uid);
            } else {
                // User is signed out. Sign them in anonymously.
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                }
            }
            setIsLoading(false);
        });
        
        // Cleanup subscription
        return () => unsubscribe();
    }, []);
    
    // PWA Install Prompt
    const [installPrompt, setInstallPrompt] = useState(null);
    useEffect(() => {
        const handler = e => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    
    const handleInstallClick = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            setInstallPrompt(null);
        });
    };


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="text-xl font-semibold text-gray-500">Loading Your Tracker...</div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Tana's Financial Skills Tracker</h1>
                    <p className="text-md text-gray-500 mt-2">Track your progress each day across the three financial goals!</p>
                     {userId && <p className="text-xs text-gray-400 mt-2 break-all">Your User ID: {userId}</p>}
                     {installPrompt && (
                        <button 
                            onClick={handleInstallClick}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                        >
                            Add to Home Screen
                        </button>
                    )}
                </header>

                <main>
                    <div>
                        <Badge className="mb-4 text-sm">X: Track Daily Spending</Badge>
                        <WeekBlock label="Spending Awareness (X)" rows={1} color="orange" prefixes={["X"]} trackerId={trackerId} userId={userId} />
                    </div>

                    <div className="mt-8">
                        <Badge className="mb-4 text-sm">Y: Budget Planning</Badge>
                        <WeekBlock label="Spending + Budgeting (X + Y)" rows={2} color="purple" prefixes={["X", "Y"]} trackerId={trackerId} userId={userId} />
                    </div>

                    <div className="mt-8">
                        <Badge className="mb-4 text-sm">Z: Saving Habit</Badge>
                        <WeekBlock label="Spending + Budgeting + Saving (X + Y + Z)" rows={3} color="orange" prefixes={["X", "Y", "Z"]} trackerId={trackerId} userId={userId} />
                    </div>
                </main>

                <footer className="mt-10">
                    <Card>
                        <CardContent>
                            <h2 className="text-lg font-semibold mb-3 text-gray-700">Emoji Key</h2>
                            <ul className="text-sm space-y-2 text-gray-600">
                                <li><span className="text-xl mr-2">🙂</span> Neutral</li>
                                <li><span className="text-xl mr-2">☺️</span> Great start</li>
                                <li><span className="text-xl mr-2">😁</span> You're doing great!</li>
                                <li><span className="text-xl mr-2">😆</span> Keep going, you've got this!</li>
                                <li><span className="text-xl mr-2">🥳</span> Congratulations!! You did it!</li>
                                <li><span className="text-xl mr-2">🤩</span> Absolutely crushed it!</li>
                                <li><span className="text-xl mr-2">😳</span> Oops, a few misses.</li>
                                <li><span className="text-xl mr-2">😔</span> You're going the wrong way.</li>
                                <li><span className="text-xl mr-2">🤯</span> Ouch, let's try again.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </footer>
            </div>
        </div>
    );
}
