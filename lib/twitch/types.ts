export type TwUser = {
  id: string;
  login: string;
  display_name: string;
  description: string;
  profile_image_url: string;
  offline_image_url?: string;
  created_at: string;
};

export type TwUsersResponse = {
  data: TwUser[];
};

export type TwStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  type: "live" | "";
};

export type TwStreamsResponse = {
  data: TwStream[];
  pagination?: { cursor?: string };
};

export type TwFollowersResponse = {
  total: number;
  data: { user_id: string; user_login: string; user_name: string; followed_at: string }[];
  pagination?: { cursor?: string };
};
