
import apiClient from '../api/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}


export const login = async (
  username: string,
  password: string
): Promise<ApiResponse<{ access_token: string; refresh_token: string }>> => {
  try {
    const { data } = await apiClient.post('/auth/login', { username, password });
    return { success: true, data };
  } catch (error: any) {
    const message = error.response?.data?.msg || error.message || 'Login failed';
    return { success: false, error: message };
  }
};

export const register = async (
  username: string,
  password: string,
  email: string,
  accessToken: string
): Promise<ApiResponse<null>> => {
  try {
    await apiClient.post(
      '/auth/register',
      { username, password, email },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return { success: true, message: 'User registered successfully' };
  } catch (error: any) {
    const message = error.response?.data?.msg || error.message || 'Registration failed';
    return { success: false, error: message };
  }
};

export const logout = async (accessToken: string): Promise<ApiResponse<null>> => {
  try {
    await apiClient.post(
      '/auth/logout',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return { success: true, message: 'Successfully logged out' };
  } catch (error: any) {
    const message = error.response?.data?.msg || error.message || 'Logout failed';
    return { success: false, error: message };
  }
};

export const refreshToken = async (
  refreshToken: string
): Promise<ApiResponse<{ access_token: string }>> => {
  try {
    const { data } = await apiClient.post(
      '/auth/refresh',
      {},
      { headers: { Authorization: `Bearer ${refreshToken}` } }
    );
    return { success: true, data: { access_token: data.access_token } };
  } catch (error: any) {
    const message = error.response?.data?.msg || error.message || 'Token refresh failed';
    return { success: false, error: message };
  }
};

const authService = { login, register, logout, refreshToken };
export default authService;
