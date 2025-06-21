import React from 'react';

const ServiceStatusCard = ({ serviceName, status }) => {
  // Define status colors and indicators
  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'up':
        return {
          color: '#28a745', // Green
          indicator: '●',
          text: 'Up'
        };
      case 'down':
        return {
          color: '#dc3545', // Red
          indicator: '●',
          text: 'Down'
        };
      case 'pending':
        return {
          color: '#ffc107', // Yellow
          indicator: '●',
          text: 'Pending'
        };
      default:
        return {
          color: '#6c757d', // Gray
          indicator: '●',
          text: 'Unknown'
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  const cardStyle = {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    margin: '8px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: '200px',
    transition: 'box-shadow 0.2s ease'
  };

  const serviceNameStyle = {
    fontSize: '16px',
    fontWeight: '500',
    color: '#333333',
    margin: 0
  };

  const statusContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const statusIndicatorStyle = {
    color: statusConfig.color,
    fontSize: '12px',
    lineHeight: 1
  };

  const statusTextStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: statusConfig.color
  };

  return (
    <div 
      style={cardStyle}
      onMouseEnter={(e) => {
        e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      }}
    >
      <h3 style={serviceNameStyle}>{serviceName}</h3>
      <div style={statusContainerStyle}>
        <span style={statusIndicatorStyle}>{statusConfig.indicator}</span>
        <span style={statusTextStyle}>{statusConfig.text}</span>
      </div>
    </div>
  );
};

export default ServiceStatusCard;