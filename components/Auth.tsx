import React, { useState } from 'react';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!name) {
      setError('First name is required');
      return;
    }

    // Simulation of backend logic
    // In a real app, we would look up the user by email to get their name on login.
    // Since this is a demo without a database, we ask for the name always.
    const user: User = {
      id: email, // simple ID
      email,
      name: name,
      joinedAt: Date.now()
    };

    onLogin(user);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 max-w-md w-full transition-colors duration-300">
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 className="text-3xl font-serif text-neutral-900 dark:text-white mb-2">{isRegistering ? 'Join StyleConfident' : 'Welcome'}</h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {isRegistering ? 'Start your style journey today.' : 'Sign in to create your digital stylist'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">First Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              placeholder="Jane"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              placeholder="jane@example.com"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full mt-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/30 transform transition-all hover:scale-[1.02]"
          >
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;