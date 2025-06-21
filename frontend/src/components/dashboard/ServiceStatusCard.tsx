import React from 'react';

interface Props {
  serviceName: string;
  status: string;
}

const ServiceStatusCard = ({ serviceName, status }: Props) => {
  const getStatusConfig = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'up':
        return { color: '#28a745', indicator: '●', text: 'Up' };
      case 'down':
        return { color: '#dc3545', indicator: '●', text: 'Down' };
      case 'pending':
        return { color: '#ffc107', indicator: '●', text: 'Pending' };
      default:
        return { color: '#6c757d', indicator: '●', text: 'Unknown' };
    }
  };

  const statusConfig = getStatusConfig(status);

  const cardStyle: React.CSSProperties = {
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
    transition: 'box-shadow 0.2s ease',
  };

  const serviceNameStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 500,
    color: '#333333',
    margin: 0,
  };

  const statusContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const statusIndicatorStyle: React.CSSProperties = {
    color: statusConfig.color,
    fontSize: '12px',
    lineHeight: 1,
  };

  const statusTextStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: statusConfig.color,
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 4px 8px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 2px 4px rgba(0, 0, 0, 0.1)';
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
