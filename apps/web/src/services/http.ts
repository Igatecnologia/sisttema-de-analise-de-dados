import { API_BASE_URL, HTTP_CLIENT_TIMEOUT_MS } from '../api/apiEnv'
import { createAuthorizedAxios } from '../api/axiosWithAuth'

export const http = createAuthorizedAxios(API_BASE_URL, HTTP_CLIENT_TIMEOUT_MS)

