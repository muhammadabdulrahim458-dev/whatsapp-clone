import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);

    // Fetch user profile using the token (optional, if server provides /api/auth/me)
    const loadUser = async () => {
        if (!token) return;
        try {
            const res = await fetch('http://localhost:5000/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setUser(data.user);
            } else {
                logout();
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (token) loadUser();
    }, [token]);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        setToken(token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);