/**
 * Dashboard Service for Media Management Web App
 * 
 * This service handles API calls to the backend dashboard endpoints.
 * It provides functions for fetching service status data.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Fetch service status data from the backend
 * @param {string} accessToken - User's access token for authorization
 * @returns {Promise<Object>} Response from the server containing service status data or error message
 */
export const getServiceStatus = async (accessToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/services/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || 'Failed to fetch service status');
    }

    return {
      success: true,
      data: data.services || [], // Expecting an array of service objects
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
};

// Default export object containing all dashboard functions
const dashboardService = {
  getServiceStatus,
};

export default dashboardService;