import React, { useState } from "react";
import { User } from "../types";

interface Props {
  onLogin: (user: User) => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required";
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(trimmed)) return "Please enter a valid email address";
    return "";
  };

  const validateName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "First name is required";
    if (trimmed.length < 2) return "First name is too short";
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = name.trim();

    const user: User = {
      id: cleanEmail,
      email: cleanEmail,
      name: cleanName,
      joinedAt: Date.now(),
    };

    onLogin(user);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 max-w-md w-full transition-colors duration-300">
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-3xl font-serif text-neutral-900 dark:text-white mb-2">
            {isRegistering ? "Join StyleConfident" : "Welcome"}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {isRegistering
              ? "Start your style journey today."
              : "Sign in to create your digital stylist"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              placeholder="Jane"
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              placeholder="jane@example.com"
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-1" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/30 transform transition-all hover:scale-[1.02]"
          >
            {isRegistering ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
            }}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
          >
            {isRegistering
              ? "Already have an account? Sign In"
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
