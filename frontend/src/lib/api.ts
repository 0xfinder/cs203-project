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

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarColor?: string;
  avatarPath?: string;
  totalScore: number;
  lessonsCompleted: number;
}

export const getLeaderboard = async (limit = 10) => {
  return await api.get(`leaderboard?limit=${limit}`).json<LeaderboardEntry[]>();
};
