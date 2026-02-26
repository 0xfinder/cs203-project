import ky from "ky";
import { getValidAccessToken } from "./session";

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api",
  credentials: "include",
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await getValidAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
