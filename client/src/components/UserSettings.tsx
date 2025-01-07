import React from "react";
import styled from "styled-components";

const SettingsContainer = styled.div`
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const ColorInput = styled.input`
  margin: 5px;
  padding: 5px;
`;

const NicknameInput = styled.input`
  margin: 5px;
  padding: 5px;
  width: 200px;
`;

interface UserSettingsProps {
  nickname: string;
  personalColor: string;
  onUpdate: (nickname: string, color: string) => void;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  nickname,
  personalColor,
  onUpdate,
}) => (
  <SettingsContainer>
    <h4>개인 설정</h4>
    <div>
      <NicknameInput
        type="text"
        value={nickname}
        placeholder="닉네임"
        onChange={(e) => onUpdate(e.target.value, personalColor)}
      />
      <ColorInput
        type="color"
        value={personalColor}
        onChange={(e) => onUpdate(nickname, e.target.value)}
      />
    </div>
  </SettingsContainer>
);
