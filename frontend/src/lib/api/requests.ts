import { MediaRequest, RequestSubmission } from '@/types/requests';

async function getAuthToken(): Promise<string | null> {
  // In Next.js with NextAuth, we can get the token from the session
  const response = await fetch('/api/auth/session');
  const session = await response.json();
  return session?.accessToken || null;
}

export async function submitMediaRequest(request: RequestSubmission): Promise<MediaRequest> {
  const token = await getAuthToken();
  
  const response = await fetch('/api/media/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit request');
  }
  
  return response.json();
}

export async function getUserRequests(): Promise<MediaRequest[]> {
  const token = await getAuthToken();
  
  const response = await fetch('/api/media/requests', {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  
  const data = await response.json();
  return data.data || data; // Handle both old and new response formats
}

export async function getRequestDetails(requestId: string): Promise<MediaRequest> {
  const token = await getAuthToken();
  
  const response = await fetch(`/api/media/requests/${requestId}`, {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch request details');
  }
  
  return response.json();
}

export async function cancelRequest(requestId: string): Promise<void> {
  const token = await getAuthToken();
  
  const response = await fetch(`/api/media/requests/${requestId}`, {
    method: 'DELETE',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel request');
  }
}