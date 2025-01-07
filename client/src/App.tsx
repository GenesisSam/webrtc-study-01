import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { WebRTCService, ConnectionState } from "./services/WebRTCService";
import { Toast } from "./components/Toast";
import { UserSettings } from "./components/UserSettings";
import { Users } from "./types/user";

const Container = styled.div`
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
`;

const MessageArea = styled.div`
  border: 1px solid #ddd;
  padding: 10px;
  margin: 10px 0;
  height: 300px;
  overflow-y: auto;
`;

const Message = styled.div`
  margin: 5px 0;
  padding: 5px;
  background: #f5f5f5;
`;

const Button = styled.button`
  padding: 10px;
  margin: 5px;
`;

const Input = styled.input`
  padding: 10px;
  margin: 5px;
`;

const StatusIndicator = styled.div<{ state: ConnectionState }>`
  padding: 5px 10px;
  border-radius: 4px;
  margin: 10px 0;
  background-color: ${({ state }) => {
    switch (state) {
      case "connected":
        return "#4CAF50";
      case "connecting":
        return "#FFC107";
      default:
        return "#F44336";
    }
  }};
  color: white;
`;

const UsersList = styled.div`
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const UserItem = styled.div`
  padding: 5px;
  margin: 2px 0;
  background: #f0f0f0;
  border-radius: 3px;

  &.me {
    background: #e3f2fd;
  }
`;

function App() {
  const [webrtc] = useState(() => new WebRTCService());
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const [users, setUsers] = useState<Users>({});
  const [nickname, setNickname] = useState("");
  const [personalColor, setPersonalColor] = useState("#000000");

  useEffect(() => {
    webrtc.onMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });

    webrtc.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    webrtc.onUsers((newUsers) => {
      setUsers(newUsers);
    });
  }, [webrtc]);

  const createRoom = async () => {
    const id = await webrtc.createRoom();
    if (id) {
      setRoomId(id);
      setIsHost(true);
    }
  };

  const joinRoom = async () => {
    if (!peerId) return;
    await webrtc.joinRoom(peerId);
    setRoomId(peerId);
    setIsHost(false);
  };

  const showToast = (message: string, type: "error" | "success" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sendMessage = async () => {
    if (!newMessage) return;
    const success = await webrtc.sendMessage(newMessage);

    if (success) {
      setMessages((prev) => [...prev, `Me: ${newMessage}`]);
      setNewMessage("");
    } else {
      showToast("메시지 전송에 실패했습니다.", "error");
    }
  };

  const handleReconnect = async () => {
    showToast("재연결 시도 중...", "info");
    const success = await webrtc.reconnect();

    if (success) {
      showToast("재연결되었습니다.", "success");
    } else {
      showToast("재연결에 실패했습니다.", "error");
    }
  };

  const updateUserSettings = (newNickname: string, newColor: string) => {
    setNickname(newNickname);
    setPersonalColor(newColor);
    webrtc.updateUserInfo(newNickname, newColor);
  };

  return (
    <Container>
      {!roomId ? (
        <>
          <Button onClick={createRoom}>방 만들기</Button>
          <div>
            <Input
              placeholder="방 ID 입력"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
            />
            <Button onClick={joinRoom}>참여하기</Button>
          </div>
        </>
      ) : (
        <>
          <h3>Room ID: {roomId}</h3>
          <UserSettings
            nickname={nickname}
            personalColor={personalColor}
            onUpdate={updateUserSettings}
          />
          <StatusIndicator state={connectionState}>
            {connectionState === "connected"
              ? "연결됨"
              : connectionState === "connecting"
              ? "연결 중..."
              : "연결 끊김"}
          </StatusIndicator>

          <UsersList>
            <h4>접속자 목록 ({Object.keys(users).length}명)</h4>
            {Object.values(users).map((user) => (
              <UserItem
                key={user.id}
                className={user.id === webrtc.getId() ? "me" : ""}
                style={{
                  backgroundColor: user.personalColor,
                  color: "#fff",
                }}
              >
                {user.nickname || user.id}
                {user.id === webrtc.getId() && " (나)"}
              </UserItem>
            ))}
          </UsersList>

          <MessageArea>
            {messages.map((msg, idx) => (
              <Message key={idx}>{msg}</Message>
            ))}
          </MessageArea>
          <div>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="메시지 입력..."
            />
            <Button onClick={sendMessage}>전송</Button>
          </div>
          {connectionState === "disconnected" && (
            <Button onClick={handleReconnect}>재연결</Button>
          )}
          {toast && <Toast message={toast.message} type={toast.type} />}
        </>
      )}
    </Container>
  );
}

export default App;
