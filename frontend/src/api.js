import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request Interceptor: Runs before every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hydra_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;