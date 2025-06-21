const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const login = async (username: string, password: string): Promise<ApiResponse<{ access_token: string; refresh_token: string }>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || 'Login failed');
    }
    return { success: true, data: { access_token: data.access_token, refresh_token: data.refresh_token } };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error occurred' };
  }
};

export const register = async (
  username: string,
  password: string,
  email: string,
  accessToken: string
): Promise<ApiResponse<null>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ username, password, email }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || 'Registration failed');
    }
    return { success: true, message: data.msg || 'User registered successfully' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error occurred' };
  }
};

export const logout = async (accessToken: string): Promise<ApiResponse<null>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || 'Logout failed');
    }
    return { success: true, message: data.msg || 'Successfully logged out' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error occurred' };
  }
};

export const refreshToken = async (
  refreshToken: string
): Promise<ApiResponse<{ access_token: string }>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || 'Token refresh failed');
    }
    return { success: true, data: { access_token: data.access_token } };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error occurred' };
  }
};

const authService = { login, register, logout, refreshToken };
export default authService;
