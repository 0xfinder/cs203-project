import ky from "ky";

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api",
  credentials: "include",
});
