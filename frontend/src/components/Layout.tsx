import { Outlet, Link, useLocation } from 'react-router-dom';
import { BarChart3, Upload as UploadIcon, LineChart, Menu } from 'lucide-react';
import { useState } from 'react';

const Layout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-bold text-blue-600">Anomaly Detect</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-gray-100">
            <Menu size={20} />
          </button>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                to="/"
                className={`flex items-center p-3 rounded-lg ${
                  location.pathname === '/' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-gray-100'
                }`}
              >
                <LineChart size={20} />
                {isSidebarOpen && <span className="ml-4">Dashboard</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/upload"
                className={`flex items-center p-3 rounded-lg ${
                  location.pathname === '/upload' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-gray-100'
                }`}
              >
                <UploadIcon size={20} />
                {isSidebarOpen && <span className="ml-4">Upload Data</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/insights"
                className={`flex items-center p-3 rounded-lg ${
                  location.pathname === '/insights' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-gray-100'
                }`}
              >
                <BarChart3 size={20} />
                {isSidebarOpen && <span className="ml-4">Insights</span>}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {location.pathname === '/' && 'Dashboard'}
            {location.pathname === '/upload' && 'Upload Data'}
            {location.pathname === '/insights' && 'Anomaly Insights'}
          </h2>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;