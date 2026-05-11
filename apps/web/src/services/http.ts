import { API_BASE_URL, HTTP_CLIENT_TIMEOUT_MS } from '../api/apiEnv'
import { createAuthorizedHttpClient } from '../api/axiosWithAuth'

export const http = createAuthorizedHttpClient(API_BASE_URL, HTTP_CLIENT_TIMEOUT_MS)

