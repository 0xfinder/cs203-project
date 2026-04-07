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
  maxCorrectStreak?: number;
  avgTimeSeconds?: number;
}

export const getLeaderboard = async (limit = 10, sortBy = "points") => {
  return await api.get(`leaderboard?limit=${limit}&sortBy=${sortBy}`).json<LeaderboardEntry[]>();
};
