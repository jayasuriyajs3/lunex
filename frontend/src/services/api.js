import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return isLocalHost ? 'http://localhost:5000/api' : 'https://lunex-2.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses — attempt refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
  getStatus: () => api.get('/auth/status'),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  logout: () => api.post('/auth/logout'),
};

// ============ MACHINES ============
export const machineAPI = {
  getAll: () => api.get('/machines'),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post('/machines', data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  updateStatus: (id, data) => api.put(`/machines/${id}/status`, data),
  delete: (id) => api.delete(`/machines/${id}`),
};

// ============ BOOKINGS ============
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getMyBookings: () => api.get('/bookings/my'),
  getById: (id) => api.get(`/bookings/${id}`),
  getSlots: (machineId, date) => api.get(`/bookings/slots/${machineId}/${date}`),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  getAll: () => api.get('/bookings/all'),
};

// ============ SESSIONS ============
export const sessionAPI = {
  start: (data) => api.post('/sessions/start', data),
  getActive: () => api.get('/sessions/active'),
  extend: (id) => api.post(`/sessions/${id}/extend`),
  end: (id) => api.post(`/sessions/${id}/end`),
  pause: (id) => api.post(`/sessions/${id}/pause`),
  resume: (id) => api.post(`/sessions/${id}/resume`),
  forceStop: (id) => api.post(`/sessions/${id}/force-stop`),
  getHistory: () => api.get('/sessions/history'),
  getAll: () => api.get('/sessions/all'),
};

// ============ ISSUES ============
export const issueAPI = {
  report: (data) => api.post('/issues', data),
  getMyIssues: () => api.get('/issues/my'),
  getAll: () => api.get('/issues/all'),
  verify: (id) => api.put(`/issues/${id}/verify`),
  resolve: (id, data) => api.put(`/issues/${id}/resolve`, data),
  dismiss: (id) => api.put(`/issues/${id}/dismiss`),
  offerPriorityRebook: (id, data) => api.post(`/issues/${id}/priority-rebook`, data),
  getPendingRebooks: () => api.get('/issues/priority-rebook/pending'),
  respondToRebook: (id, data) => api.put(`/issues/priority-rebook/${id}/respond`, data),
};

// ============ NOTIFICATIONS ============
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// ============ ADMIN ============
export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  getPendingUsers: () => api.get('/admin/users/pending'),
  approveUser: (data) => api.put('/admin/users/approve', data),
  rejectUser: (data) => api.put('/admin/users/reject', data),
  blockUser: (data) => api.put('/admin/users/block', data),
  unblockUser: (data) => api.put('/admin/users/unblock', data),
  assignRfid: (data) => api.put('/admin/users/assign-rfid', data),
  revokeRfid: (data) => api.put('/admin/users/revoke-rfid', data),
  changeRole: (data) => api.put('/admin/users/change-role', data),
  resetPassword: (data) => api.put('/admin/users/reset-password', data),
  getConfig: () => api.get('/admin/config'),
  setConfig: (data) => api.put('/admin/config', data),
  deleteConfig: (key) => api.delete(`/admin/config/${key}`),
  emergencyShutdown: () => api.post('/admin/emergency/shutdown'),
  emergencyReset: () => api.post('/admin/emergency/reset'),
  getDashboard: () => api.get('/admin/analytics/dashboard'),
  getMachineUtilization: () => api.get('/admin/analytics/machine-utilization'),
  getNoShows: () => api.get('/admin/analytics/no-shows'),
  getPeakUsage: () => api.get('/admin/analytics/peak-usage'),
};

export default api;
