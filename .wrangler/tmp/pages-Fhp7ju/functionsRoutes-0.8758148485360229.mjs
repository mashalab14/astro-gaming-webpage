import { onRequestOptions as __api_user_js_onRequestOptions } from "/Users/asamanta/Desktop/webpage_template/functions/api/user.js"
import { onRequestPost as __api_user_js_onRequestPost } from "/Users/asamanta/Desktop/webpage_template/functions/api/user.js"
import { onRequest as __api_debug_users_js_onRequest } from "/Users/asamanta/Desktop/webpage_template/functions/api/debug-users.js"
import { onRequest as __api_user_validate_js_onRequest } from "/Users/asamanta/Desktop/webpage_template/functions/api/user-validate.js"

export const routes = [
    {
      routePath: "/api/user",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_user_js_onRequestOptions],
    },
  {
      routePath: "/api/user",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_user_js_onRequestPost],
    },
  {
      routePath: "/api/debug-users",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_debug_users_js_onRequest],
    },
  {
      routePath: "/api/user-validate",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_user_validate_js_onRequest],
    },
  ]