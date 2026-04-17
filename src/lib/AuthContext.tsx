import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: any | null;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, userData: null, refreshUserData: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async (currentUser?: User) => {
    const activeUser = currentUser || auth.currentUser;
    if (activeUser) {
      const docRef = doc(db, 'users', activeUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        // Create user doc if it doesn't exist
        const newUserData = {
          uid: activeUser.uid,
          email: activeUser.email || '',
          displayName: activeUser.displayName || 'Developer',
          photoUrl: activeUser.photoURL || '',
          role: 'developer',
          createdAt: serverTimestamp()
        };
        await setDoc(docRef, newUserData);
        setUserData(newUserData);
      }
    } else {
      setUserData(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      await refreshUserData(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userData, refreshUserData }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
