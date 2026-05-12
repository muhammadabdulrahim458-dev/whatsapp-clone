import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json();
            if (res.ok) {
                login({ _id: data._id, username: data.username, email: data.email }, data.token);
                navigate('/');
            } else {
                setError(data.message || 'Registration failed');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
                <h2 className="text-2xl font-bold mb-4">Register</h2>
                {error && <p className="text-red-500 mb-2">{error}</p>}
                <input className="w-full border p-2 mb-3" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                <input className="w-full border p-2 mb-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="w-full border p-2 mb-3" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="w-full bg-green-500 text-white p-2 rounded" type="submit">Register</button>
                <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="text-blue-500">Login</Link></p>
            </form>
        </div>
    );
};

export default Register;