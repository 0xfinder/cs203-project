import ky from "ky";
import { supabase } from "./supabase";

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api",
  credentials: "include",
  hooks: {
    beforeRequest: [
      async (request) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
