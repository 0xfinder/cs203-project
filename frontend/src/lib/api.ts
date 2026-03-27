import ky from "ky";
import { getValidAccessToken } from "./session";

export const api = ky.create({
  prefixUrl: "/api",
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
