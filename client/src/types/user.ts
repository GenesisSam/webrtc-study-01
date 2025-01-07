export interface UserInfo {
  id: string;
  nickname: string;
  personalColor: string;
}

export type Users = { [key: string]: UserInfo };
