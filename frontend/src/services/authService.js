/**
 * Authentication Service for Media Management Web App
 * 
 * This service handles API calls to the backend authentication endpoints.
 * It provides functions for user login and registration.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Login function - authenticates a user with username and password
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} Response from the server containing tokens or error message
 */
export const login = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || 'Login failed');
    }

    return {
      success: true,
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
};

/**
 * Register function - registers a new user (admin only)
 * @param {string} username - New user's username
 * @param {string} password - New user's password
 * @param {string} email - New user's email (optional)
 * @param {string} accessToken - Admin's access token for authorization
 * @returns {Promise<Object>} Response from the server
 */
export const register = async (username, password, email, accessToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        username,
        password,
        email,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || 'Registration failed');
    }

    return {
      success: true,
      message: data.msg || 'User registered successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
};

/**
 * Logout function - logs out the current user by blacklisting the JWT
 * @param {string} accessToken - User's access token
 * @returns {Promise<Object>} Response from the server
 */
export const logout = async (accessToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || 'Logout failed');
    }

    return {
      success: true,
      message: data.msg || 'Successfully logged out',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
};

/**
 * Refresh token function - gets a new access token using refresh token
 * @param {string} refreshToken - User's refresh token
 * @returns {Promise<Object>} Response from the server containing new access token
 */
export const refreshToken = async (refreshToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || 'Token refresh failed');
    }

    return {
      success: true,
      data: {
        access_token: data.access_token,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
};

// Default export object containing all auth functions
const authService = {
  login,
  register,
  logout,
  refreshToken,
};

export default authService;