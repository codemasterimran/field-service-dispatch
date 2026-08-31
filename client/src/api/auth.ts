import { api } from './client';
import { User } from '../types';

export interface LoginResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  register: (data: { email: string; password: string; name: string; role: string }) =>
    api.post<LoginResponse>('/auth/register', data),

  me: () => api.get<{ user: User }>('/auth/me'),
};
