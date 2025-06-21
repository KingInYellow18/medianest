const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const getServiceStatus = async (accessToken: string): Promise<ApiResponse<Array<{ id?: number; name: string; status: string }>>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/services/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || 'Failed to fetch service status');
    }
    return { success: true, data: data.services || [] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error occurred' };
  }
};

const dashboardService = { getServiceStatus };
export default dashboardService;
