
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ServiceStatusCard from '../components/dashboard/ServiceStatusCard';
import useServiceStatus, { Service } from '../hooks/useServiceStatus';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const {
    data: serviceData,
    error,
    isLoading,
    refetch,
  } = useServiceStatus(!!token);


  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleRetry = () => {
    if (!token) return;

    refetch();
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Media Management Dashboard</h1>
        {user && <p>Welcome, {user.username}!</p>}
        <button
          onClick={handleLogout}
          className="logout-button"
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px',
          }}
        >
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <h2>System Overview</h2>
        <p>
          Welcome to your media management dashboard. Here you can monitor system
          status and manage your media files.
        </p>

        <div className="service-status-section">
          <h3>Service Status</h3>


          {isLoading && (
            <div className="loading-indicator" style={{ padding: '20px', textAlign: 'center' }}>
              <p>Loading service status...</p>
            </div>
          )}

          {error && (
            <div
              className="error-message"
              style={{
                padding: '15px',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                marginBottom: '20px',
              }}
            >
              <p>Error: {error}</p>
              <button
                onClick={handleRetry}
                className="retry-btn"
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px',
                }}
              >
                Retry
              </button>
            </div>
          )}


          {!isLoading && !error && (
            <div
              className="service-status-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                marginTop: '20px',
              }}
            >

              {serviceData?.length ? (
                serviceData.map((service, index) => (
                  <ServiceStatusCard
                    key={service.id || service.name || index}
                    serviceName={service.name}
                    status={service.status}
                  />
                ))
              ) : (
                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6c757d' }}>
                  No service status data available.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
