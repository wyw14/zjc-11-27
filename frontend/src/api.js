import axios from 'axios'

const TOKEN_KEY = 'admin_token'

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use(
  (config) => {
    const token = getAdminToken()
    if (token && config.url.startsWith('/admin/')) {
      config.headers['x-admin-token'] = token
    }
    return config
  },
  (err) => Promise.reject(err)
)

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err?.response?.status === 401) {
      clearAdminToken()
    }
    const msg = err?.response?.data?.error || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export const api = {
  getConfig: () => request.get('/config'),
  getStories: () => request.get('/stories'),
  getStory: (id) => request.get(`/stories/${id}`),
  createStory: (data) => request.post('/stories', data),
  addEntry: (id, data) => request.post(`/stories/${id}/entries`, data),
  adminLogin: (password) => request.post('/admin/login', { password }),
  adminLogout: () => request.post('/admin/logout'),
  resetStory: (id) => request.post(`/admin/stories/${id}/reset`),
  getSensitiveWords: () => request.get('/admin/sensitive-words'),
  addSensitiveWord: (word) => request.post('/admin/sensitive-words', { word }),
  deleteSensitiveWord: (id) => request.delete(`/admin/sensitive-words/${id}`)
}

export default api

