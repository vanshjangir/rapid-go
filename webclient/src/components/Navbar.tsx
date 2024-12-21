import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  const [logged, setLogged] = useState<boolean>(isLoggedIn);
  const nav = useNavigate();

  useEffect(() => {
    setLogged(isLoggedIn);
  }, []);

  return (
    <nav className="bg-[#222222] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-slate-300 hover:text-white">
              Rapid-Go
            </a>
            <div className="hidden md:block ml-10 space-x-4">
              <a href="/learn" className="hover:text-slate-400">
                Learn
              </a>
              <a href="/tournaments" className="hover:text-slate-400">
                Tournaments
              </a>
              <a href="/community" className="hover:text-slate-400">
                Community
              </a>
            </div>
          </div>
          <div className="flex items-center">
            <div className="hidden md:block">
              {logged ? (
                <div>
                  <span className="px-4 py-2 font-bold text-slate-300">
                    <a href="" onClick={() => { nav(`/profile/${username}`)}} className="hover:underline">
                      {username}
                    </a>
                  </span>
                  <a href="" onClick={() => { localStorage.clear(); setLogged(false)}} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded">
                    Logout
                  </a>
                </div>
              ) : (
                <>
                  <a href="/login" className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded">
                    Login
                  </a>
                  <a href="/signup" className="ml-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded">
                    Sign Up
                  </a>
                </>
              )}
            </div>
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <span className="sr-only">Open menu</span>
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            <a href="/learn" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-gray-700">
              Learn
            </a>
            <a href="/tournaments" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-gray-700">
              Tournaments
            </a>
            <a href="/community" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-gray-700">
              Community
            </a>
            {logged ? (
              <div className="flex flex-col">
                <span className="px-4 py-2 font-bold text-slate-300">
                  {username}
                </span>
                <a href="" onClick={() => { localStorage.clear(); setLogged(false)}} className="block px-3 py-2 rounded-md text-base font-medium bg-slate-600 hover:bg-slate-500">
                  Logout
                </a>
              </div>
            ) : (
              <>
                <a href="/login" className="block px-3 py-2 rounded-md text-base font-medium bg-slate-600 hover:bg-slate-500">
                  Login
                </a>
                <a href="/signup" className="block px-3 py-2 rounded-md text-base font-medium bg-blue-600 hover:bg-blue-500">
                  Sign Up
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
