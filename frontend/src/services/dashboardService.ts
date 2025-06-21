import apiClient from '../api/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const getServiceStatus = async (): Promise<ApiResponse<Array<{ id?: number; name: string; status: string }>>> => {
  try {
    const { data } = await apiClient.get('/services/status');
    return { success: true, data: data.services || [] };
  } catch (error: any) {
    const message = error.response?.data?.msg || error.message || 'Failed to fetch service status';
    return { success: false, error: message };
  }
};

const dashboardService = { getServiceStatus };
export default dashboardService;
